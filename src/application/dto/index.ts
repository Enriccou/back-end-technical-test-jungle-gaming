import { MoneyProps } from '../../domain/value-objects/Money';

// ===== Requests =====

export interface CreateWalletRequest {
  playerId: string;
  initialBalance: MoneyProps;
}

export interface SubmitWagerTransactionRequest {
  providerId: string;
  externalTransactionId: string;
  playerId: string;
  walletId: string;
  roundId: string;
  gameId: string;
  kind: 'BET' | 'WIN' | 'LOSS' | 'REFUND' | 'ROLLBACK';
  money: MoneyProps;
  referenceExternalTransactionId?: string;
}

export interface ReconciliationRequest {
  walletId: string;
  storedBalance: MoneyProps;
  calculatedBalance: MoneyProps;
}

// ===== Responses =====

export interface WalletResponse {
  id: string;
  playerId: string;
  balance: MoneyProps;
  version: number;
}

export interface WagerTransactionResponse {
  transactionId: string;
  status: string;
  balance: MoneyProps;
  idempotentReplay: boolean;
  failureCode?: string;
}

export interface LedgerEntryResponse {
  id: string;
  transactionId: string;
  direction: string;
  money: MoneyProps;
  balanceBefore: MoneyProps;
  balanceAfter: MoneyProps;
  createdAt: string;
}

export interface WalletLedgerResponse {
  walletId: string;
  entries: LedgerEntryResponse[];
  nextCursor?: string;
}

export interface ReconciliationResponse {
  walletId: string;
  storedBalance: MoneyProps;
  calculatedBalance: MoneyProps;
  difference: MoneyProps;
  consistent: boolean;
  checkedEntries: number;
}

export interface HealthResponse {
  status: 'up' | 'down';
  timestamp: string;
}

export interface ReadinessResponse {
  ready: boolean;
  checks: {
    database: boolean;
    sqs: boolean;
  };
}
