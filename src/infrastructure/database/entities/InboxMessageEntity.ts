import { Entity, PrimaryKey, Property, Unique, Index } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

@Entity({ tableName: 'inbox_messages' })
@Unique({ properties: ['consumerName', 'messageId'] })
@Index({ properties: ['consumerName', 'processedAt'] })
export class InboxMessageEntity {
  @PrimaryKey({ type: 'uuid', onCreate: () => uuid() })
  id!: string;

  @Property({ type: 'varchar', fieldName: 'messageId' })
  messageId!: string;

  @Property({ type: 'varchar', fieldName: 'consumerName' })
  consumerName!: string;

  @Property({ type: 'varchar', fieldName: 'payloadHash' })
  payloadHash!: string;

  @Property({ type: 'timestamptz', fieldName: 'receivedAt' })
  receivedAt: Date = new Date();

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'processedAt' })
  processedAt?: Date;
}
