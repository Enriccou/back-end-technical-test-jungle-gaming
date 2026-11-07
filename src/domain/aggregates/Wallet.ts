import { Money } from '../value-objects/Money';
import { WalletLedgerEntry, LedgerDirection } from '../entities/WalletLedgerEntry';
import { v4 as uuid } from 'uuid';

export interface WalletState {
  id: string;
  playerId: string;
  currency: string;
  balance: any;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export class Wallet {
  private constructor(
    public readonly id: string,
    public readonly playerId: string,
    public readonly currency: string,
    private _balance: Money,
    private _version: number,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static open(props: {
    id?: string;
    playerId: string;
    initialBalance: Money;
  }): Wallet {
    const id = props.id || uuid();
    const now = new Date();

    const wallet = new Wallet(
      id,
      props.playerId,
      props.initialBalance.currency,
      props.initialBalance,
      props.initialBalance.isZero() ? 0 : 1,
      now,
      now,
    );

    return wallet;
  }

  static rehydrate(state: WalletState): Wallet {
    return new Wallet(
      state.id,
      state.playerId,
      state.currency,
      Money.from(state.balance),
      state.version,
      new Date(state.createdAt),
      new Date(state.updatedAt),
    );
  }

  get balance(): Money {
    return this._balance;
  }

  get version(): number {
    return this._version;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  debit(amount: Money): WalletLedgerEntry {
    this.assertSameCurrency(amount);

    if (amount.isLessThan(Money.zero(this.currency)) || amount.isZero()) {
      throw new Error('Debit amount must be positive');
    }

    if (this._balance.isLessThan(amount)) {
      throw new Error('Insufficient balance');
    }

    const newBalance = this._balance.subtract(amount);
    const entry = WalletLedgerEntry.create({
      walletId: this.id,
      transactionId: '', // será preenchido depois
      direction: LedgerDirection.Debit,
      money: amount,
      balanceBefore: this._balance,
      balanceAfter: newBalance,
    });

    this._balance = newBalance;
    this._version++;
    this._updatedAt = new Date();

    return entry;
  }

  credit(amount: Money): WalletLedgerEntry {
    this.assertSameCurrency(amount);

    if (amount.isLessThan(Money.zero(this.currency)) || amount.isZero()) {
      throw new Error('Credit amount must be positive');
    }

    const newBalance = this._balance.add(amount);
    const entry = WalletLedgerEntry.create({
      walletId: this.id,
      transactionId: '', // será preenchido depois
      direction: LedgerDirection.Credit,
      money: amount,
      balanceBefore: this._balance,
      balanceAfter: newBalance,
    });

    this._balance = newBalance;
    this._version++;
    this._updatedAt = new Date();

    return entry;
  }

  /** Reconstrói saldo a partir do ledger - para reconciliação */
  reconstructBalanceFromLedger(entries: WalletLedgerEntry[]): Money {
    let balance = Money.zero(this.currency);

    for (const entry of entries) {
      if (entry.direction === LedgerDirection.Debit) {
        balance = balance.subtract(entry.money);
      } else {
        balance = balance.add(entry.money);
      }
    }

    return balance;
  }

  private assertSameCurrency(money: Money): void {
    if (money.currency !== this.currency) {
      throw new Error(
        `Currency mismatch: wallet ${this.currency} vs operation ${money.currency}`,
      );
    }
  }
}
