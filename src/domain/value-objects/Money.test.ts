import { describe, it, expect } from 'bun:test';
import { Money } from './Money';

describe('Money', () => {
  describe('creation', () => {
    it('creates money from string amount', () => {
      const money = Money.from({ amount: '100.50', currency: 'BRL' });
      expect(money.toJSON().amount).toBe('100.50');
      expect(money.currency).toBe('BRL');
    });

    it('rejects negative amount', () => {
      expect(() => Money.from({ amount: '-50.00', currency: 'BRL' })).toThrow();
    });

    it('rejects invalid amount format', () => {
      expect(() => Money.from({ amount: 'invalid', currency: 'BRL' })).toThrow();
    });
  });

  describe('zero', () => {
    it('creates zero money', () => {
      const zero = Money.zero('BRL');
      expect(zero.isZero()).toBe(true);
    });
  });

  describe('arithmetic', () => {
    it('adds money correctly', () => {
      const a = Money.from({ amount: '100.00', currency: 'BRL' });
      const b = Money.from({ amount: '50.00', currency: 'BRL' });
      const result = a.add(b);
      expect(result.toJSON().amount).toBe('150.00');
    });

    it('subtracts money correctly', () => {
      const a = Money.from({ amount: '100.00', currency: 'BRL' });
      const b = Money.from({ amount: '30.00', currency: 'BRL' });
      const result = a.subtract(b);
      expect(result.toJSON().amount).toBe('70.00');
    });

    it('maintains decimal precision (0.1 + 0.2 = 0.3)', () => {
      const a = Money.from({ amount: '0.1', currency: 'BRL' });
      const b = Money.from({ amount: '0.2', currency: 'BRL' });
      const result = a.add(b);
      expect(result.toJSON().amount).toBe('0.30');
    });

    it('rejects subtraction resulting in negative', () => {
      const a = Money.from({ amount: '50.00', currency: 'BRL' });
      const b = Money.from({ amount: '100.00', currency: 'BRL' });
      expect(() => a.subtract(b)).toThrow();
    });
  });

  describe('comparison', () => {
    it('equals same amount', () => {
      const a = Money.from({ amount: '100.00', currency: 'BRL' });
      const b = Money.from({ amount: '100.00', currency: 'BRL' });
      expect(a.equals(b)).toBe(true);
    });

    it('not equals different amount', () => {
      const a = Money.from({ amount: '100.00', currency: 'BRL' });
      const b = Money.from({ amount: '99.99', currency: 'BRL' });
      expect(a.equals(b)).toBe(false);
    });

    it('detects less than', () => {
      const a = Money.from({ amount: '50.00', currency: 'BRL' });
      const b = Money.from({ amount: '100.00', currency: 'BRL' });
      expect(a.isLessThan(b)).toBe(true);
    });
  });

  describe('currency validation', () => {
    it('rejects different currencies in operations', () => {
      const brl = Money.from({ amount: '100.00', currency: 'BRL' });
      const usd = Money.from({ amount: '100.00', currency: 'USD' });
      expect(() => brl.add(usd)).toThrow('Currency mismatch');
    });
  });
});
