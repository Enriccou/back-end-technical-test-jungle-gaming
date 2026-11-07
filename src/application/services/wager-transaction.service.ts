import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { LockMode } from '@mikro-orm/core';
import crypto from 'crypto';
import {
  SubmitWagerTransactionRequest,
  WagerTransactionResponse,
} from '@/application/dto';
import { Money } from '@/domain/value-objects/Money';
import { Wallet } from '@/domain/aggregates/Wallet';
import { WagerTransaction, FailureCode, WagerTransactionStatus } from '@/domain/entities/WagerTransaction';
import { WalletLedgerEntry } from '@/domain/entities/WalletLedgerEntry';
import { IdempotencyService } from './idempotency.service';
import { WalletEntity } from '@/infrastructure/database/entities/WalletEntity';
import { WagerTransactionEntity } from '@/infrastructure/database/entities/WagerTransactionEntity';
import { WalletLedgerEntryEntity } from '@/infrastructure/database/entities/WalletLedgerEntryEntity';
import { InboxMessageEntity } from '@/infrastructure/database/entities/InboxMessageEntity';
import { OutboxMessageEntity } from '@/infrastructure/database/entities/OutboxMessageEntity';

@Injectable()
export class WagerTransactionService {
  constructor(
    private em: EntityManager,
    private idempotencyService: IdempotencyService,
  ) {}

  async submitTransaction(
    dto: SubmitWagerTransactionRequest,
    idempotencyKey: string,
  ): Promise<WagerTransactionResponse> {
    const money = Money.from(dto.money);
    const payloadHash = this.idempotencyService.computePayloadHash(dto);

    return this.em.transactional(async (em) => {
      // 1. Verificar idempotência - se já processado, retornar resultado original
      const existing = await em.findOne(WagerTransactionEntity, {
        idempotencyKey,
      });

      if (existing) {
        // Payload conflitante?
        if (existing.payloadHash !== payloadHash) {
          throw new BadRequestException({
            statusCode: 409,
            message: 'Conflict: same idempotency key with different payload',
            code: 'PAYLOAD_CONFLICT',
          });
        }

        // Retornar resultado original
        const wallet = await em.findOne(WalletEntity, {
          id: existing.walletId,
        });

        return {
          transactionId: existing.id,
          status: existing.status,
          balance: {
            amount: wallet!.balance,
            currency: wallet!.currency,
          },
          idempotentReplay: true,
        };
      }

      // 2. Carregar wallet com lock pessimista (FOR UPDATE)
      const wallet = await em.findOne(
        WalletEntity,
        { id: dto.walletId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );

      if (!wallet) {
        throw new NotFoundException(`Wallet ${dto.walletId} not found`);
      }

      // 3. Validar moeda
      if (wallet.currency !== money.currency) {
        throw new BadRequestException({
          statusCode: 422,
          message: 'Currency mismatch',
          code: 'CURRENCY_MISMATCH',
        });
      }

      // 4. Rehydrate wallet domain object
      const walletDomain = Wallet.rehydrate({
        id: wallet.id,
        playerId: wallet.playerId,
        currency: wallet.currency,
        balance: {
          amount: wallet.balance,
          currency: wallet.currency,
        },
        version: wallet.version,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      });

      // 5. Criar WagerTransaction
      const txDomain = WagerTransaction.create({
        providerId: dto.providerId,
        externalTransactionId: dto.externalTransactionId,
        idempotencyKey,
        payloadHash,
        walletId: dto.walletId,
        playerId: dto.playerId,
        roundId: dto.roundId,
        gameId: dto.gameId,
        kind: dto.kind as any,
        money,
        referenceExternalTransactionId: dto.referenceExternalTransactionId,
      });

      // 6. Processar de acordo com o kind
      let ledgerEntry: WalletLedgerEntry | null = null;
      let status = 'PROCESSED';
      let failureCode: FailureCode | undefined;
      let referenceTransactionId: string | undefined;

      try {
        if (txDomain.kind === 'BET') {
          // Tentar fazer debit
          ledgerEntry = walletDomain.debit(money);
        } else if (txDomain.kind === 'WIN') {
          ledgerEntry = walletDomain.credit(money);
        } else if (txDomain.kind === 'LOSS') {
          // Não afeta saldo, mas registra
          status = 'PROCESSED';
        } else if (txDomain.kind === 'REFUND' || txDomain.kind === 'ROLLBACK') {
          // Precisamos encontrar a transação referenciada
          const reference = await em.findOne(WagerTransactionEntity, {
            providerId: dto.providerId,
            externalTransactionId: dto.referenceExternalTransactionId,
            walletId: dto.walletId,
          });

          if (!reference) {
            // Referência não encontrada - marcar como PENDING_REFERENCE
            status = 'PENDING_REFERENCE';
          } else {
            // Validar referência
            const refDomain = WagerTransaction.rehydrate(reference);

            if (refDomain.kind === 'LOSS' || !refDomain.affectsBalance()) {
              failureCode = FailureCode.ReferenceMismatch;
              status = 'REJECTED';
            } else if (
              txDomain.kind === 'REFUND' &&
              refDomain.kind !== 'BET'
            ) {
              failureCode = FailureCode.ReferenceMismatch;
              status = 'REJECTED';
            } else if (refDomain.status !== WagerTransactionStatus.Processed) {
              failureCode = FailureCode.ReferenceNotFound;
              status = 'REJECTED';
            } else {
              // Aplicar reversão
              const direction = refDomain.ledgerDirectionFor();
              if (direction === 'DEBIT') {
                ledgerEntry = walletDomain.credit(money);
              } else {
                ledgerEntry = walletDomain.debit(money);
              }
              referenceTransactionId = reference.id;
            }
          }
        }
      } catch (error: any) {
        if (error.message.includes('Insufficient balance')) {
          failureCode = FailureCode.InsufficientBalance;
          status = 'REJECTED';
        } else if (error.message.includes('negative')) {
          failureCode = FailureCode.ReversalWouldBeNegative;
          status = 'REJECTED';
        } else {
          failureCode = FailureCode.InvalidTransitionState;
          status = 'FAILED';
        }
      }

      // 7. Atualizar wallet na BD se houver mudança de saldo
      if (status === 'PROCESSED' && ledgerEntry) {
        wallet.balance = walletDomain.balance.toJSON().amount;
        wallet.version = walletDomain.version;
        wallet.updatedAt = new Date();
        em.persist(wallet);

        // Persistir ledger entry
        const ledgerEntity = em.create(WalletLedgerEntryEntity, {
          walletId: dto.walletId,
          transactionId: txDomain.id,
          direction: ledgerEntry.direction,
          amount: ledgerEntry.money.toJSON().amount,
          currency: ledgerEntry.money.currency,
          balanceBefore: ledgerEntry.balanceBefore.toJSON().amount,
          balanceAfter: ledgerEntry.balanceAfter.toJSON().amount,
          createdAt: new Date(),
        });
        em.persist(ledgerEntity);
      }

      // 8. Persistir transação
      const txEntity = em.create(WagerTransactionEntity, {
        id: txDomain.id,
        providerId: dto.providerId,
        externalTransactionId: dto.externalTransactionId,
        idempotencyKey,
        payloadHash,
        walletId: dto.walletId,
        playerId: dto.playerId,
        roundId: dto.roundId,
        gameId: dto.gameId,
        kind: dto.kind,
        amount: money.toJSON().amount,
        currency: money.currency,
        referenceExternalTransactionId: dto.referenceExternalTransactionId,
        status,
        referenceTransactionId,
        failureCode,
        createdAt: new Date(),
        processedAt: status === 'PROCESSED' || status === 'REJECTED' ? new Date() : undefined,
        retryAttempts: 0,
      });
      em.persist(txEntity);

      await em.flush();

      return {
        transactionId: txDomain.id,
        status,
        balance: {
          amount: wallet.balance,
          currency: wallet.currency,
        },
        idempotentReplay: false,
        failureCode,
      };
    });
  }

  async getTransaction(transactionId: string): Promise<WagerTransactionResponse> {
    const tx = await this.em.findOne(WagerTransactionEntity, {
      id: transactionId,
    });

    if (!tx) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    const wallet = await this.em.findOne(WalletEntity, { id: tx.walletId });

    return {
      transactionId: tx.id,
      status: tx.status,
      balance: {
        amount: wallet!.balance,
        currency: wallet!.currency,
      },
      idempotentReplay: false,
      failureCode: tx.failureCode,
    };
  }

  async getTransactionByProvider(
    providerId: string,
    externalTransactionId: string,
  ): Promise<WagerTransactionResponse> {
    const tx = await this.em.findOne(WagerTransactionEntity, {
      providerId,
      externalTransactionId,
    });

    if (!tx) {
      throw new NotFoundException(
        `Transaction ${providerId}:${externalTransactionId} not found`,
      );
    }

    const wallet = await this.em.findOne(WalletEntity, { id: tx.walletId });

    return {
      transactionId: tx.id,
      status: tx.status,
      balance: {
        amount: wallet!.balance,
        currency: wallet!.currency,
      },
      idempotentReplay: false,
      failureCode: tx.failureCode,
    };
  }
}
