import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

@Entity({ tableName: 'wallets' })
@Unique({ properties: ['playerId', 'currency'] })
@Index({ properties: ['playerId'] })
export class WalletEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

  @Property({ type: 'uuid', fieldName: 'playerId' })
  playerId!: string;

  @Property({ type: 'varchar', length: 3 })
  currency!: string;

  @Property({ type: 'decimal', precision: 19, scale: 2 })
  balance!: string;

  @Property({ type: 'int' })
  version: number = 0;

  @Property({ type: 'timestamptz', fieldName: 'createdAt' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', onUpdate: () => new Date(), fieldName: 'updatedAt' })
  updatedAt: Date = new Date();
}
