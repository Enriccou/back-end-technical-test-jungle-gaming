import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  CreateWalletRequest,
  WalletResponse,
  WalletLedgerResponse,
  LedgerEntryResponse,
  ReconciliationRequest,
  ReconciliationResponse
} from '@/application/dto';
import { Money } from '@/domain/value-objects/Money';
import { Wallet } from '@/domain/aggregates/Wallet';
import { WalletEntity } from '@/infrastructure/database/entities/WalletEntity';
import { WalletLedgerEntryEntity } from '@/infrastructure/database/entities/WalletLedgerEntryEntity';
import { WagerTransactionEntity } from '@/infrastructure/database/entities/WagerTransactionEntity';
import { WagerTransaction } from '@/domain/entities/WagerTransaction';

@Injectable()
export class WalletService {
  constructor(private em: EntityManager) {}

  async createWallet(dto: CreateWalletRequest): Promise<WalletResponse> {
    const initialBalance = Money.from(dto.initialBalance);

    // Verificar se wallet já existe
    const existing = await this.em.findOne(WalletEntity, {
      playerId: dto.playerId,
      currency: initialBalance.currency,
    });

    if (existing) {
      throw new Error(
        `Wallet already exists for player ${dto.playerId} in currency ${initialBalance.currency}`,
      );
    }

    // Criar wallet no domínio
    const wallet = Wallet.open({
      playerId: dto.playerId,
      initialBalance,
    });

    // Persistir na mesma transação
    return this.em.transactional(async (em) => {
      const walletEntity = em.create(WalletEntity, {
        id: wallet.id,
        playerId: wallet.playerId,
        currency: wallet.currency,
        balance: wallet.balance.toJSON().amount,
        version: wallet.version,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      });

      em.persist(walletEntity);
      await em.flush();

      // Se saldo inicial > 0, criar transação OPENING
      if (!initialBalance.isZero()) {
        const openingTx = WagerTransaction.createOpening(
          wallet.id,
          wallet.playerId,
          initialBalance,
        );

        const ledgerEntry = wallet.credit(initialBalance);

        // Persistir transação OPENING
        const txEntity = em.create(WagerTransactionEntity, {
          id: openingTx.id,
          providerId: 'SYSTEM',
          externalTransactionId: openingTx.externalTransactionId,
          idempotencyKey: openingTx.idempotencyKey,
          payloadHash: openingTx.payloadHash,
          walletId: wallet.id,
          playerId: wallet.playerId,
          roundId: 'N/A',
          gameId: 'N/A',
          kind: 'OPENING',
          amount: initialBalance.toJSON().amount,
          currency: initialBalance.currency,
          status: 'PROCESSED',
          createdAt: new Date(),
          processedAt: new Date(),
          retryAttempts: 0,
        });

        em.persist(txEntity);

        // Persistir ledger entry
        const ledgerEntity = em.create(WalletLedgerEntryEntity, {
          walletId: wallet.id,
          transactionId: openingTx.id,
          direction: 'CREDIT',
          amount: initialBalance.toJSON().amount,
          currency: initialBalance.currency,
          balanceBefore: Money.zero(initialBalance.currency)
            .toJSON()
            .amount,
          balanceAfter: initialBalance.toJSON().amount,
          createdAt: new Date(),
        });

        em.persist(ledgerEntity);
      }

      await em.flush();

      return {
        id: wallet.id,
        playerId: wallet.playerId,
        balance: wallet.balance.toJSON(),
        version: wallet.version,
      };
    });
  }

  async getWallet(walletId: string): Promise<WalletResponse> {
    const wallet = await this.em.findOne(WalletEntity, { id: walletId });

    if (!wallet) {
      throw new NotFoundException(`Wallet ${walletId} not found`);
    }

    return {
      id: wallet.id,
      playerId: wallet.playerId,
      balance: {
        amount: wallet.balance,
        currency: wallet.currency,
      },
      version: wallet.version,
    };
  }

  async getLedger(
    walletId: string,
    cursor?: string,
    limit: number = 50,
  ): Promise<WalletLedgerResponse> {
    const wallet = await this.em.findOne(WalletEntity, { id: walletId });
    if (!wallet) {
      throw new NotFoundException(`Wallet ${walletId} not found`);
    }

    limit = Math.max(1, Math.min(limit || 50, 1000));
    const qb = this.em.createQueryBuilder(WalletLedgerEntryEntity, 'e');
    qb.where('e."walletId" = ?', [walletId])
      .orderBy({ createdAt: 'ASC' })
      .limit(limit + 1);

    if (cursor) {
      const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
      qb.andWhere('e.createdAt > ?', [new Date(decodedCursor)]);
    }

    const entries = await qb.getResult();

    const hasMore = entries.length > limit;
    const result = entries.slice(0, limit);

    const nextCursor = hasMore
      ? Buffer.from(result[result.length - 1].createdAt.toISOString()).toString(
          'base64',
        )
      : undefined;

    return {
      walletId,
      entries: result.map((e) => ({
        id: e.id,
        transactionId: e.transactionId,
        direction: e.direction,
        money: {
          amount: e.amount,
          currency: e.currency,
        },
        balanceBefore: {
          amount: e.balanceBefore,
          currency: e.currency,
        },
        balanceAfter: {
          amount: e.balanceAfter,
          currency: e.currency,
        },
        createdAt: e.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async reconcile(
    walletId: string,
    dto: ReconciliationRequest,
  ): Promise<ReconciliationResponse> {
    const wallet = await this.em.findOne(WalletEntity, { id: walletId });
    if (!wallet) {
      throw new NotFoundException(`Wallet ${walletId} not found`);
    }

    // Calcular saldo a partir do ledger
    const entries = await this.em.find(WalletLedgerEntryEntity, {
      walletId,
    });

    let calculatedBalance = Money.zero(wallet.currency);
    for (const entry of entries) {
      const amount = Money.from({
        amount: entry.amount,
        currency: entry.currency,
      });

      if (entry.direction === 'DEBIT') {
        calculatedBalance = calculatedBalance.subtract(amount);
      } else {
        calculatedBalance = calculatedBalance.add(amount);
      }
    }

    const storedBalance = Money.from({
      amount: wallet.balance,
      currency: wallet.currency,
    });

    const difference = storedBalance.equals(calculatedBalance)
      ? Money.zero(wallet.currency)
      : Money.from({
          amount: storedBalance.get_decimal().minus(calculatedBalance.get_decimal()).toString(),
          currency: wallet.currency,
        });

    return {
      walletId,
      storedBalance: storedBalance.toJSON(),
      calculatedBalance: calculatedBalance.toJSON(),
      difference: difference.toJSON(),
      consistent: storedBalance.equals(calculatedBalance),
      checkedEntries: entries.length,
    };
  }
}
