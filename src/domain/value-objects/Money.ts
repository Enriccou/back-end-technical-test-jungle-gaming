import Decimal from 'decimal.js';

export interface MoneyProps {
  amount: string;
  currency: string;
}

export class Money {
  private constructor(
    private readonly value: Decimal,
    public readonly currency: string,
  ) {
    this.validateInvariants();
  }

  static from(props: MoneyProps): Money {
    const { amount, currency } = props;

    if (!currency || typeof currency !== 'string') {
      throw new Error('Currency must be a non-empty string');
    }

    const decimal = new Decimal(amount);

    if (decimal.isNaN()) {
      throw new Error('Invalid amount: NaN');
    }

    if (!decimal.isFinite()) {
      throw new Error('Invalid amount: Infinity');
    }

    if (decimal.decimalPlaces() > 2) {
      throw new Error('Amount must have at most 2 decimal places');
    }

    if (decimal.isNegative()) {
      throw new Error('Amount cannot be negative');
    }

    return new Money(decimal, currency);
  }

  static zero(currency: string): Money {
    return new Money(new Decimal(0), currency);
  }

  static from_internal(value: Decimal, currency: string): Money {
    return new Money(value, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this.value.plus(other.value);
    return new Money(result, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    const result = this.value.minus(other.value);
    if (result.isNegative()) {
      throw new Error('Result would be negative');
    }
    return new Money(result, this.currency);
  }

  negate(): Money {
    const result = this.value.negated();
    return new Money(result.abs(), this.currency);
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  isPositive(): boolean {
    return this.value.isPositive();
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.value.lessThan(other.value);
  }

  isLessThanOrEqual(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.value.lessThanOrEqualTo(other.value);
  }

  equals(other: Money): boolean {
    if (this.currency !== other.currency) {
      return false;
    }
    return this.value.equals(other.value);
  }

  get_decimal(): Decimal {
    return this.value;
  }

  toJSON(): MoneyProps {
    return {
      amount: this.value.toFixed(2),
      currency: this.currency,
    };
  }

  toString(): string {
    return `${this.value.toFixed(2)} ${this.currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(
        `Currency mismatch: ${this.currency} vs ${other.currency}`,
      );
    }
  }

  private validateInvariants(): void {
    if (this.value.isNegative()) {
      throw new Error('Money value cannot be negative');
    }
  }
}
