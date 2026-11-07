import { describe, it, expect } from 'bun:test';
import { WagerTransaction, WagerTransactionStatus } from './WagerTransaction';
import { Money } from '../value-objects/Money';

describe('WagerTransaction', () => {
  describe('create', () => {
    it('creates transaction with PENDING status', () => {
      const tx = WagerTransaction.create({
        providerId: 'GAMES_INC',
        externalTransactionId: 'ext-001',
        idempotencyKey: 'key-001',
        payloadHash: 'hash-001',
        walletId: 'wallet-123',
        playerId: 'player-123',
        roundId: 'round-001',
        gameId: 'game-001',
        kind: 'BET',
        money: Money.from({ amount: '100.00', currency: 'BRL' }),
      });

      expect(tx.status).toBe(WagerTransactionStatus.Pending);
      expect(tx.kind).toBe('BET');
    });
  });

  describe('affectsBalance', () => {
    it('BET affects balance', () => {
      const tx = WagerTransaction.create({
        providerId: 'GAMES_INC',
        externalTransactionId: 'ext-001',
        idempotencyKey: 'key-001',
        payloadHash: 'hash-001',
        walletId: 'wallet-123',
        playerId: 'player-123',
        roundId: 'round-001',
        gameId: 'game-001',
        kind: 'BET',
        money: Money.from({ amount: '100.00', currency: 'BRL' }),
      });

      expect(tx.affectsBalance()).toBe(true);
    });

    it('LOSS does not affect balance', () => {
      const tx = WagerTransaction.create({
        providerId: 'GAMES_INC',
        externalTransactionId: 'ext-001',
        idempotencyKey: 'key-001',
        payloadHash: 'hash-001',
        walletId: 'wallet-123',
        playerId: 'player-123',
        roundId: 'round-001',
        gameId: 'game-001',
        kind: 'LOSS',
        money: Money.from({ amount: '0', currency: 'BRL' }),
      });

      expect(tx.affectsBalance()).toBe(false);
    });

    it('WIN affects balance', () => {
      const tx = WagerTransaction.create({
        providerId: 'GAMES_INC',
        externalTransactionId: 'ext-001',
        idempotencyKey: 'key-001',
        payloadHash: 'hash-001',
        walletId: 'wallet-123',
        playerId: 'player-123',
        roundId: 'round-001',
        gameId: 'game-001',
        kind: 'WIN',
        money: Money.from({ amount: '250.00', currency: 'BRL' }),
      });

      expect(tx.affectsBalance()).toBe(true);
    });
  });

  describe('ledgerDirection', () => {
    it('BET is DEBIT', () => {
      const tx = WagerTransaction.create({
        providerId: 'GAMES_INC',
        externalTransactionId: 'ext-001',
        idempotencyKey: 'key-001',
        payloadHash: 'hash-001',
        walletId: 'wallet-123',
        playerId: 'player-123',
        roundId: 'round-001',
        gameId: 'game-001',
        kind: 'BET',
        money: Money.from({ amount: '100.00', currency: 'BRL' }),
      });

      expect(tx.ledgerDirectionFor()).toBe('DEBIT');
    });

    it('WIN is CREDIT', () => {
      const tx = WagerTransaction.create({
        providerId: 'GAMES_INC',
        externalTransactionId: 'ext-001',
        idempotencyKey: 'key-001',
        payloadHash: 'hash-001',
        walletId: 'wallet-123',
        playerId: 'player-123',
        roundId: 'round-001',
        gameId: 'game-001',
        kind: 'WIN',
        money: Money.from({ amount: '250.00', currency: 'BRL' }),
      });

      expect(tx.ledgerDirectionFor()).toBe('CREDIT');
    });

    it('REFUND reverses BET (CREDIT)', () => {
      const tx = WagerTransaction.create({
        providerId: 'GAMES_INC',
        externalTransactionId: 'ext-refund-001',
        idempotencyKey: 'key-refund-001',
        payloadHash: 'hash-refund-001',
        walletId: 'wallet-123',
        playerId: 'player-123',
        roundId: 'round-001',
        gameId: 'game-001',
        kind: 'REFUND',
        money: Money.from({ amount: '100.00', currency: 'BRL' }),
        referenceExternalTransactionId: 'ext-001',
      });

      expect(tx.ledgerDirectionFor()).toBe('CREDIT');
    });
  });
});
