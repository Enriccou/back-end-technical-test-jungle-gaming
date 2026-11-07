import { describe, it, expect } from 'bun:test';
import { Wallet } from './Wallet';
import { Money } from '../value-objects/Money';

describe('Wallet', () => {
  describe('open', () => {
    it('creates wallet with initial balance', () => {
      const balance = Money.from({ amount: '1000.00', currency: 'BRL' });
      const wallet = Wallet.open({
        playerId: 'player-123',
        initialBalance: balance,
      });

      expect(wallet.playerId).toBe('player-123');
      expect(wallet.balance.toJSON().amount).toBe('1000.00');
      expect(wallet.currency).toBe('BRL');
    });

    it('has version 1 when balance > 0', () => {
      const balance = Money.from({ amount: '500.00', currency: 'BRL' });
      const wallet = Wallet.open({
        playerId: 'player-123',
        initialBalance: balance,
      });

      expect(wallet.version).toBe(1);
    });

    it('has version 0 when balance = 0', () => {
      const balance = Money.zero('BRL');
      const wallet = Wallet.open({
        playerId: 'player-123',
        initialBalance: balance,
      });

      expect(wallet.version).toBe(0);
    });
  });

  describe('credit', () => {
    it('increases balance and version', () => {
      const balance = Money.from({ amount: '100.00', currency: 'BRL' });
      const wallet = Wallet.open({
        playerId: 'player-123',
        initialBalance: balance,
      });

      const creditAmount = Money.from({ amount: '50.00', currency: 'BRL' });
      wallet.credit(creditAmount);

      expect(wallet.balance.toJSON().amount).toBe('150.00');
      expect(wallet.version).toBe(2);
    });

    it('rejects credit of zero or negative', () => {
      const balance = Money.from({ amount: '100.00', currency: 'BRL' });
      const wallet = Wallet.open({
        playerId: 'player-123',
        initialBalance: balance,
      });

      const zeroAmount = Money.zero('BRL');
      expect(() => wallet.credit(zeroAmount)).toThrow();
    });
  });

  describe('debit', () => {
    it('decreases balance and version', () => {
      const balance = Money.from({ amount: '200.00', currency: 'BRL' });
      const wallet = Wallet.open({
        playerId: 'player-123',
        initialBalance: balance,
      });

      const debitAmount = Money.from({ amount: '50.00', currency: 'BRL' });
      wallet.debit(debitAmount);

      expect(wallet.balance.toJSON().amount).toBe('150.00');
      expect(wallet.version).toBe(2);
    });

    it('rejects debit exceeding balance', () => {
      const balance = Money.from({ amount: '50.00', currency: 'BRL' });
      const wallet = Wallet.open({
        playerId: 'player-123',
        initialBalance: balance,
      });

      const debitAmount = Money.from({ amount: '100.00', currency: 'BRL' });
      expect(() => wallet.debit(debitAmount)).toThrow();
    });

    it('rejects debit of zero or negative', () => {
      const balance = Money.from({ amount: '100.00', currency: 'BRL' });
      const wallet = Wallet.open({
        playerId: 'player-123',
        initialBalance: balance,
      });

      const zeroAmount = Money.zero('BRL');
      expect(() => wallet.debit(zeroAmount)).toThrow();
    });
  });

  describe('ledger trail', () => {
    it('tracks balance changes', () => {
      const balance = Money.from({ amount: '1000.00', currency: 'BRL' });
      const wallet = Wallet.open({
        playerId: 'player-123',
        initialBalance: balance,
      });

      wallet.debit(Money.from({ amount: '100.00', currency: 'BRL' }));
      expect(wallet.balance.toJSON().amount).toBe('900.00');

      wallet.credit(Money.from({ amount: '50.00', currency: 'BRL' }));
      expect(wallet.balance.toJSON().amount).toBe('950.00');
    });
  });
});
