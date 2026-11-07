import { Migration } from '@mikro-orm/migrations';

export class Migration20261104001Initial extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "playerId" UUID NOT NULL,
        currency VARCHAR(3) NOT NULL,
        balance DECIMAL(19, 2) NOT NULL DEFAULT 0,
        version INT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT wallets_player_currency_unique UNIQUE ("playerId", currency)
      );

      CREATE INDEX idx_wallets_player_id ON wallets("playerId");

      ALTER TABLE wallets ADD CONSTRAINT wallets_balance_non_negative CHECK (balance >= 0);
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS wager_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "providerId" VARCHAR(255) NOT NULL,
        "externalTransactionId" VARCHAR(255) NOT NULL,
        "idempotencyKey" VARCHAR(255) NOT NULL UNIQUE,
        "payloadHash" VARCHAR(255) NOT NULL,
        "walletId" UUID NOT NULL REFERENCES wallets(id),
        "playerId" UUID NOT NULL,
        "roundId" VARCHAR(255) NOT NULL,
        "gameId" VARCHAR(255) NOT NULL,
        kind VARCHAR(50) NOT NULL,
        amount DECIMAL(19, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        "referenceExternalTransactionId" VARCHAR(255),
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        "referenceTransactionId" UUID,
        "failureCode" VARCHAR(255),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "processedAt" TIMESTAMPTZ,
        "retryAttempts" INT DEFAULT 0,
        "nextRetryAt" TIMESTAMPTZ
      );

      CREATE INDEX idx_wager_transactions_wallet_id ON wager_transactions("walletId");
      CREATE INDEX idx_wager_transactions_provider_external ON wager_transactions("providerId", "externalTransactionId");
      CREATE INDEX idx_wager_transactions_status ON wager_transactions(status);
      CREATE INDEX idx_wager_transactions_idempotency_key ON wager_transactions("idempotencyKey");
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "walletId" UUID NOT NULL REFERENCES wallets(id),
        "transactionId" UUID NOT NULL,
        direction VARCHAR(10) NOT NULL,
        amount DECIMAL(19, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        "balanceBefore" DECIMAL(19, 2) NOT NULL,
        "balanceAfter" DECIMAL(19, 2) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_wallet_ledger_entries_wallet_id ON wallet_ledger_entries("walletId");
      CREATE INDEX idx_wallet_ledger_entries_transaction_id ON wallet_ledger_entries("transactionId");
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS inbox_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "messageId" VARCHAR(255) NOT NULL,
        "consumerName" VARCHAR(255) NOT NULL,
        "payloadHash" VARCHAR(255) NOT NULL,
        "receivedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "processedAt" TIMESTAMPTZ,
        CONSTRAINT inbox_messages_unique UNIQUE ("consumerName", "messageId")
      );

      CREATE INDEX idx_inbox_messages_consumer_processed ON inbox_messages("consumerName", "processedAt");
    `);

    this.addSql(`
      CREATE TABLE IF NOT EXISTS outbox_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "aggregateId" UUID NOT NULL,
        "eventType" VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        "occurredAt" TIMESTAMPTZ NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        "nextAttemptAt" TIMESTAMPTZ,
        "publishedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_outbox_messages_aggregate_id ON outbox_messages("aggregateId");
      CREATE INDEX idx_outbox_messages_published_at ON outbox_messages("publishedAt");
      CREATE INDEX idx_outbox_messages_pending ON outbox_messages("publishedAt") WHERE "publishedAt" IS NULL;
    `);
  }

  async down(): Promise<void> {
    this.addSql('DROP TABLE IF EXISTS outbox_messages;');
    this.addSql('DROP TABLE IF EXISTS inbox_messages;');
    this.addSql('DROP TABLE IF EXISTS wallet_ledger_entries;');
    this.addSql('DROP TABLE IF EXISTS wager_transactions;');
    this.addSql('DROP TABLE IF EXISTS wallets;');
  }
}
