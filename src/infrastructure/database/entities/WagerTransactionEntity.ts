import { Entity, PrimaryKey, Property, Index, Unique, ManyToOne } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';
import { WalletEntity } from './WalletEntity';

@Entity({ tableName: 'wager_transactions' })
@Unique({ properties: ['idempotencyKey'] })
@Index({ properties: ['walletId'] })
@Index({ properties: ['providerId', 'externalTransactionId'] })
@Index({ properties: ['status'] })
export class WagerTransactionEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'varchar', fieldName: 'providerId' })
  providerId!: string;

  @Property({ type: 'varchar', fieldName: 'externalTransactionId' })
  externalTransactionId!: string;

  @Property({ type: 'varchar', fieldName: 'idempotencyKey' })
  idempotencyKey!: string;

  @Property({ type: 'varchar', fieldName: 'payloadHash' })
  payloadHash!: string;

  @Property({ type: 'uuid', fieldName: 'walletId' })
  walletId!: string;

  @Property({ type: 'uuid', fieldName: 'playerId' })
  playerId!: string;

  @Property({ type: 'varchar', fieldName: 'roundId' })
  roundId!: string;

  @Property({ type: 'varchar', fieldName: 'gameId' })
  gameId!: string;

  @Property({ type: 'varchar' })
  kind!: string; // BET, WIN, LOSS, REFUND, ROLLBACK, OPENING

  @Property({ type: 'decimal', precision: 19, scale: 2 })
  amount!: string;

  @Property({ type: 'varchar', length: 3 })
  currency!: string;

  @Property({ type: 'varchar', nullable: true, fieldName: 'referenceExternalTransactionId' })
  referenceExternalTransactionId?: string;

  @Property({ type: 'varchar' })
  status!: string; // PENDING, PENDING_REFERENCE, PROCESSED, REJECTED, FAILED

  @Property({ type: 'uuid', nullable: true, fieldName: 'referenceTransactionId' })
  referenceTransactionId?: string;

  @Property({ type: 'varchar', nullable: true, fieldName: 'failureCode' })
  failureCode?: string;

  @Property({ type: 'timestamptz', fieldName: 'createdAt' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'processedAt' })
  processedAt?: Date;

  @Property({ type: 'int', default: 0, fieldName: 'retryAttempts' })
  retryAttempts: number = 0;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'nextRetryAt' })
  nextRetryAt?: Date;
}
