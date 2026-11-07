import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

@Entity({ tableName: 'wallet_ledger_entries' })
@Index({ properties: ['walletId'] })
@Index({ properties: ['transactionId'] })
export class WalletLedgerEntryEntity {
  @PrimaryKey({ type: 'uuid', onCreate: () => uuid() })
  id!: string;

  @Property({ type: 'uuid', fieldName: 'walletId' })
  walletId!: string;

  @Property({ type: 'uuid', fieldName: 'transactionId' })
  transactionId!: string;

  @Property({ type: 'varchar' })
  direction!: string; // DEBIT, CREDIT

  @Property({ type: 'decimal', precision: 19, scale: 2 })
  amount!: string;

  @Property({ type: 'varchar', length: 3 })
  currency!: string;

  @Property({ type: 'decimal', precision: 19, scale: 2, fieldName: 'balanceBefore' })
  balanceBefore!: string;

  @Property({ type: 'decimal', precision: 19, scale: 2, fieldName: 'balanceAfter' })
  balanceAfter!: string;

  @Property({ type: 'timestamptz', fieldName: 'createdAt' })
  createdAt: Date = new Date();
}
