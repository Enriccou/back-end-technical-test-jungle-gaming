# Jungle Gaming - Distributed Wagering Processor

Sistema backend de processamento de transações de apostas com foco em **segurança financeira**, **concorrência** e **idempotência**.

---

## 📋 Pré-requisitos

- **Node.js** >= 20.0.0
- **Bun** >= 1.0.0
- **Docker** + **Docker Compose**
- **Git**

---

## 🚀 Quick Start

### 1. Instalar e configurar

```bash
cd C:\Users\enric\OneDrive\Documentos\Teste-tecnico-jungle-gaming
bun install
cp .env.example .env
```

### 2. Subir infraestrutura

```bash
docker-compose up -d
bun run db:migrate
```

### 3. Iniciar servidor

```bash
npm run dev
```

Servidor rodando em **http://localhost:3031**

---

## 📡 Curls para Testar

### 1. Health Check

```bash
curl http://localhost:3031/health/live
```

### 2. Gerar JWT Token

```bash
curl -X POST http://localhost:3031/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "playerId":"550e8400-e29b-41d4-a716-446655440001",
    "providerId":"GAMES_INC"
  }'
```

**Copie o `access_token` retornado e use nos próximos curls**

### 3. Criar Wallet

```bash
curl -X POST http://localhost:3031/wallets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {access_token}" \
  -d '{
    "playerId":"550e8400-e29b-41d4-a716-446655440001",
    "initialBalance":{"amount":"1000.00","currency":"BRL"}
  }'
```

**Copie o `id` retornado para os próximos curls**

### 4. Obter Wallet

```bash
curl http://localhost:3031/wallets/{wallet_id} \
  -H "Authorization: Bearer {access_token}"
```

### 5. Ver Ledger (Movimentações)

```bash
curl http://localhost:3031/wallets/{wallet_id}/ledger \
  -H "Authorization: Bearer {access_token}"
```

### 6. BET (Aposta - Debita)

```bash
curl -X POST http://localhost:3031/wagering/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {access_token}" \
  -H "idempotency-key: bet-001" \
  -d '{
    "walletId":"{wallet_id}",
    "playerId":"550e8400-e29b-41d4-a716-446655440001",
    "providerId":"GAMES_INC",
    "externalTransactionId":"ext-bet-001",
    "roundId":"round-123",
    "gameId":"slots-777",
    "kind":"BET",
    "money":{"amount":"100.00","currency":"BRL"}
  }'
```

### 7. WIN (Ganho - Credita)

```bash
curl -X POST http://localhost:3031/wagering/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {access_token}" \
  -H "idempotency-key: win-001" \
  -d '{
    "walletId":"{wallet_id}",
    "playerId":"550e8400-e29b-41d4-a716-446655440001",
    "providerId":"GAMES_INC",
    "externalTransactionId":"ext-win-001",
    "roundId":"round-123",
    "gameId":"slots-777",
    "kind":"WIN",
    "money":{"amount":"250.00","currency":"BRL"}
  }'
```

### 8. Testar Idempotência (Replay)

```bash
curl -X POST http://localhost:3031/wagering/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {access_token}" \
  -H "idempotency-key: bet-001" \
  -d '{
    "walletId":"{wallet_id}",
    "playerId":"550e8400-e29b-41d4-a716-446655440001",
    "providerId":"GAMES_INC",
    "externalTransactionId":"ext-bet-001",
    "roundId":"round-123",
    "gameId":"slots-777",
    "kind":"BET",
    "money":{"amount":"100.00","currency":"BRL"}
  }'
```

Retorna `"idempotentReplay": true` - sem debit adicional!

### 9. Reconciliação

```bash
curl -X POST http://localhost:3031/wallets/{wallet_id}/reconciliation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {access_token}" \
  -d '{}'
```

Verificar: `"consistent": true` - saldo armazenado = saldo calculado do ledger

### 10. Obter Transação

```bash
curl http://localhost:3031/wagering/transactions/{transaction_id} \
  -H "Authorization: Bearer {access_token}"
```

### 11. REFUND (Reverter Aposta)

```bash
curl -X POST http://localhost:3031/wagering/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {access_token}" \
  -H "idempotency-key: refund-001" \
  -d '{
    "walletId":"{wallet_id}",
    "playerId":"550e8400-e29b-41d4-a716-446655440001",
    "providerId":"GAMES_INC",
    "externalTransactionId":"ext-refund-001",
    "roundId":"round-123",
    "gameId":"slots-777",
    "kind":"REFUND",
    "referenceExternalTransactionId":"ext-bet-001",
    "money":{"amount":"100.00","currency":"BRL"}
  }'
```

---

## 🧪 Rodar Testes

### Testes Unitários (Domain)

```bash
bun test
```

Resultado esperado:
```
✓ 24 tests - ALL PASSING
```

### Testes Individuais

```bash
bun test src/domain/value-objects/Money.test.ts
bun test src/domain/aggregates/Wallet.test.ts
bun test src/domain/entities/WagerTransaction.test.ts
```

---

## 📊 Endpoints Disponíveis

### Autenticação
- `POST /auth/token` - Gerar JWT

### Wallets
- `POST /wallets` - Criar carteira
- `GET /wallets/:walletId` - Obter carteira
- `GET /wallets/:walletId/ledger` - Ver movimentações
- `POST /wallets/:walletId/reconciliation` - Reconciliar

### Transações
- `POST /wagering/transactions` - Processar transação (BET, WIN, LOSS, REFUND, ROLLBACK)
- `GET /wagering/transactions/:transactionId` - Obter transação
- `GET /wagering/providers/:providerId/wagering/transactions/:externalTransactionId` - Por provider

### Saúde
- `GET /health/live` - Status
- `GET /health/ready` - Dependências

---

## 🛑 Parar

### Servidor
```bash
Ctrl+C
```

### Containers
```bash
docker-compose down
```

---

## 📚 Documentação

- [DECISOES-TECNICAS.md](./docs/DECISOES-TECNICAS.md) - Design decisions
- [AUTHENTICATION.md](./docs/AUTHENTICATION.md) - JWT auth details
- [DELIVERABLES.md](./DELIVERABLES.md) - O que foi entregue

---

## ✅ Checklist Rápido

- [ ] `npm run dev` roda
- [ ] `curl http://localhost:3031/health/live` = 200
- [ ] Gerar token com POST /auth/token
- [ ] Criar wallet
- [ ] Fazer BET (debita)
- [ ] Replay BET (sem debit adicional)
- [ ] WIN (credita)
- [ ] Reconciliação (consistent: true)
- [ ] `bun test` passa
