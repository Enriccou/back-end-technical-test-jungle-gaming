import { Entity, PrimaryKey, Property, Index } from '@mikro-orm/core';
import { v4 as uuid } from 'uuid';

@Entity({ tableName: 'outbox_messages' })
@Index({ properties: ['aggregateId'] })
@Index({ properties: ['publishedAt'] })
export class OutboxMessageEntity {
  @PrimaryKey({ type: 'uuid', onCreate: () => uuid() })
  id!: string;

  @Property({ type: 'uuid', fieldName: 'aggregateId' })
  aggregateId!: string;

  @Property({ type: 'varchar', fieldName: 'eventType' })
  eventType!: string;

  @Property({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Property({ type: 'timestamptz', fieldName: 'occurredAt' })
  occurredAt!: Date;

  @Property({ type: 'int' })
  attempts: number = 0;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'nextAttemptAt' })
  nextAttemptAt?: Date;

  @Property({ type: 'timestamptz', nullable: true, fieldName: 'publishedAt' })
  publishedAt?: Date;

  @Property({ type: 'timestamptz', fieldName: 'createdAt' })
  createdAt: Date = new Date();

  // Helper computed properties
  get isPending(): boolean {
    return !this.publishedAt;
  }

  isDue(now: Date): boolean {
    if (!this.isPending) return false;
    if (!this.nextAttemptAt) return true;
    return now >= this.nextAttemptAt;
  }
}
