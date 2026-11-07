import { Money } from '../value-objects/Money';
import { v4 as uuid } from 'uuid';

export enum LedgerDirection {
  Debit = 'DEBIT',
  Credit = 'CREDIT',
}

export interface CreateLedgerEntryProps {
  walletId: string;
  transactionId: string;
  direction: LedgerDirection;
  money: Money;
  balanceBefore: Money;
  balanceAfter: Money;
  createdAt?: Date;
}

export class WalletLedgerEntry {
  private constructor(
    public readonly id: string,
    public readonly walletId: string,
    public readonly transactionId: string,
    public readonly direction: LedgerDirection,
    public readonly money: Money,
    public readonly balanceBefore: Money,
    public readonly balanceAfter: Money,
    public readonly createdAt: Date,
  ) {}

  static create(props: CreateLedgerEntryProps): WalletLedgerEntry {
    const { walletId, transactionId, direction, money, balanceBefore, balanceAfter, createdAt } = props;

    // Validar aritmética: balanceBefore ± money === balanceAfter
    let expectedBalance: Money;
    if (direction === LedgerDirection.Debit) {
      expectedBalance = balanceBefore.subtract(money);
    } else {
      expectedBalance = balanceBefore.add(money);
    }

    if (!expectedBalance.equals(balanceAfter)) {
      throw new Error(
        `Ledger entry arithmetic mismatch: ${balanceBefore.toString()} ${direction} ${money.toString()} != ${balanceAfter.toString()}`,
      );
    }

    return new WalletLedgerEntry(
      uuid(),
      walletId,
      transactionId,
      direction,
      money,
      balanceBefore,
      balanceAfter,
      createdAt || new Date(),
    );
  }

  static rehydrate(state: any): WalletLedgerEntry {
    return new WalletLedgerEntry(
      state.id,
      state.walletId,
      state.transactionId,
      state.direction,
      Money.from(state.money),
      Money.from(state.balanceBefore),
      Money.from(state.balanceAfter),
      new Date(state.createdAt),
    );
  }

  isBalanced(): boolean {
    let expectedBalance: Money;
    if (this.direction === LedgerDirection.Debit) {
      expectedBalance = this.balanceBefore.subtract(this.money);
    } else {
      expectedBalance = this.balanceBefore.add(this.money);
    }
    return expectedBalance.equals(this.balanceAfter);
  }
}
