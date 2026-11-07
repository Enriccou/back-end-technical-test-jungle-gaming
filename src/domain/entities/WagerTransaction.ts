import { Money } from '../value-objects/Money';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

export enum WagerTransactionKind {
  Opening = 'OPENING',
  Bet = 'BET',
  Win = 'WIN',
  Loss = 'LOSS',
  Refund = 'REFUND',
  Rollback = 'ROLLBACK',
}

export enum WagerTransactionStatus {
  Pending = 'PENDING',
  PendingReference = 'PENDING_REFERENCE',
  Processed = 'PROCESSED',
  Rejected = 'REJECTED',
  Failed = 'FAILED',
}

export enum FailureCode {
  InsufficientBalance = 'INSUFFICIENT_BALANCE',
  ReversalWouldBeNegative = 'REVERSAL_WOULD_BE_NEGATIVE',
  ReferenceNotFound = 'REFERENCE_NOT_FOUND',
  ReferenceAlreadyProcessed = 'REFERENCE_ALREADY_PROCESSED',
  InvalidTransitionState = 'INVALID_TRANSITION_STATE',
  PayloadConflict = 'PAYLOAD_CONFLICT',
  CurrencyMismatch = 'CURRENCY_MISMATCH',
  ReferenceMismatch = 'REFERENCE_MISMATCH',
}

export enum LedgerDirection {
  Debit = 'DEBIT',
  Credit = 'CREDIT',
}

export interface CreateWagerTransactionProps {
  providerId: string;
  externalTransactionId: string;
  idempotencyKey: string;
  payloadHash: string;
  walletId: string;
  playerId: string;
  roundId: string;
  gameId: string;
  kind: WagerTransactionKind;
  money: Money;
  referenceExternalTransactionId?: string;
  createdAt?: Date;
}

export class WagerTransaction {
  private constructor(
    public readonly id: string,
    public readonly providerId: string,
    public readonly externalTransactionId: string,
    public readonly idempotencyKey: string,
    public readonly payloadHash: string,
    public readonly walletId: string,
    public readonly playerId: string,
    public readonly roundId: string,
    public readonly gameId: string,
    public readonly kind: WagerTransactionKind,
    public readonly money: Money,
    public readonly referenceExternalTransactionId: string | undefined,
    public readonly createdAt: Date,
    private _status: WagerTransactionStatus,
    private _referenceTransactionId?: string,
    private _failureCode?: FailureCode,
    private _processedAt?: Date,
  ) {}

  static create(props: CreateWagerTransactionProps): WagerTransaction {
    const { kind, referenceExternalTransactionId } = props;

    if (kind === WagerTransactionKind.Opening) {
      throw new Error('OPENING transactions cannot be created via API');
    }

    if (
      (kind === WagerTransactionKind.Refund ||
        kind === WagerTransactionKind.Rollback) &&
      !referenceExternalTransactionId
    ) {
      throw new Error(`${kind} requires referenceExternalTransactionId`);
    }

    return new WagerTransaction(
      uuid(),
      props.providerId,
      props.externalTransactionId,
      props.idempotencyKey,
      props.payloadHash,
      props.walletId,
      props.playerId,
      props.roundId,
      props.gameId,
      kind,
      props.money,
      referenceExternalTransactionId,
      props.createdAt || new Date(),
      WagerTransactionStatus.Pending,
    );
  }

  static createOpening(walletId: string, playerId: string, money: Money, createdAt?: Date): WagerTransaction {
    return new WagerTransaction(
      uuid(),
      'SYSTEM',
      `opening-${uuid()}`,
      `system:opening-${uuid()}`,
      'opening',
      walletId,
      playerId,
      'N/A',
      'N/A',
      WagerTransactionKind.Opening,
      money,
      undefined,
      createdAt || new Date(),
      WagerTransactionStatus.Pending,
    );
  }

  static rehydrate(state: any): WagerTransaction {
    return new WagerTransaction(
      state.id,
      state.providerId,
      state.externalTransactionId,
      state.idempotencyKey,
      state.payloadHash,
      state.walletId,
      state.playerId,
      state.roundId,
      state.gameId,
      state.kind,
      Money.from(state.money),
      state.referenceExternalTransactionId,
      new Date(state.createdAt),
      state.status,
      state.referenceTransactionId,
      state.failureCode,
      state.processedAt ? new Date(state.processedAt) : undefined,
    );
  }

  get status(): WagerTransactionStatus {
    return this._status;
  }

  get referenceTransactionId(): string | undefined {
    return this._referenceTransactionId;
  }

  get failureCode(): FailureCode | undefined {
    return this._failureCode;
  }

  get processedAt(): Date | undefined {
    return this._processedAt;
  }

  markProcessed(referenceTransactionId: string | undefined, at: Date): void {
    if (this.isTerminal()) {
      throw new Error(
        `Cannot transition from terminal state ${this._status}`,
      );
    }
    this._status = WagerTransactionStatus.Processed;
    this._referenceTransactionId = referenceTransactionId;
    this._processedAt = at;
  }

  markPendingReference(): void {
    if (this.isTerminal()) {
      throw new Error(
        `Cannot transition from terminal state ${this._status}`,
      );
    }
    this._status = WagerTransactionStatus.PendingReference;
  }

  reject(code: FailureCode): void {
    if (this.isTerminal()) {
      throw new Error(
        `Cannot transition from terminal state ${this._status}`,
      );
    }
    this._status = WagerTransactionStatus.Rejected;
    this._failureCode = code;
  }

  fail(code: FailureCode): void {
    if (this.isTerminal()) {
      throw new Error(
        `Cannot transition from terminal state ${this._status}`,
      );
    }
    this._status = WagerTransactionStatus.Failed;
    this._failureCode = code;
  }

  isTerminal(): boolean {
    return [
      WagerTransactionStatus.Processed,
      WagerTransactionStatus.Rejected,
      WagerTransactionStatus.Failed,
    ].includes(this._status);
  }

  affectsBalance(): boolean {
    return this.kind !== WagerTransactionKind.Loss;
  }

  requiresReference(): boolean {
    return [
      WagerTransactionKind.Refund,
      WagerTransactionKind.Rollback,
    ].includes(this.kind);
  }

  matchesPayload(payloadHash: string): boolean {
    return this.payloadHash === payloadHash;
  }

  ledgerDirectionFor(reference?: WagerTransaction): LedgerDirection {
    switch (this.kind) {
      case WagerTransactionKind.Bet:
        return LedgerDirection.Debit;
      case WagerTransactionKind.Win:
        return LedgerDirection.Credit;
      case WagerTransactionKind.Refund:
        return LedgerDirection.Credit;
      case WagerTransactionKind.Rollback:
        if (!reference) {
          throw new Error('ROLLBACK requires reference transaction');
        }
        return reference.ledgerDirectionFor() === LedgerDirection.Debit
          ? LedgerDirection.Credit
          : LedgerDirection.Debit;
      case WagerTransactionKind.Opening:
        return LedgerDirection.Credit;
      case WagerTransactionKind.Loss:
      default:
        throw new Error(`${this.kind} does not affect balance`);
    }
  }
}
