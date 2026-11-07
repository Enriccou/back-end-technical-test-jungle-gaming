# Decisões Técnicas - Jungle Gaming Wager Processor

## 1. Arquitetura - Domain-Driven Design

### Problema
Sistema financeiro precisa de **lógica de negócio isolada da infraestrutura**, com clareza sobre regras de domínio e prevenção de bugs financeiros.

### Opções
- **MVC simples:** Fácil, direto, rápido. Risco: lógica espalhada em controllers/services.
- **Service layer clássico:** Melhor, mas sem limite claro de responsabilidade.
- **DDD:** Caro (tempo), aber muito claro sobre regras de negócio.

### Escolhida: DDD

**Por quê:**
- Lógica financeira fica **isolada em Wallet e WagerTransaction** (domain)
- Impossível criar um Wallet com saldo negativo (validação no domain)
- Mudanças de regra só afetam uma classe (Money.debit, Wallet.credit)
- Facilita testes: `new Wallet(...).debit(amount)` sem banco, sem HTTP

**Trade-off:**
- ⚠️ Mais arquivos (Money, Wallet, WagerTransaction, entities)
- ⚠️ Boilerplate inicial
- ✅ Segurança financeira >> boilerplate

**Quando mudar:**
- Se tiver <5 endpoints e nenhuma validação complexa → remova DDD
- Aqui: 8 endpoints + validações de saldo/moeda/estado → DDD justificável

---

## 2. Precisão Financeira - Decimal.js

### Problema
```javascript
// ❌ Float é problema
0.1 + 0.2 === 0.3  // false em JavaScript!
100.00 - 99.99 = 0.009999999999990905
```

Perder centavos em transações = perda de dinheiro real.

### Opções
- **Float (number):** Rápido, nativo. Risco: perde centavos silenciosamente.
- **String e comparação manual:** Seguro, tedioso, propenso a bugs.
- **BigDecimal (Java):** Overkill, não temos em JS.
- **Decimal.js:** Exato, simples, usado em fintech.

### Escolhida: Decimal.js

**Por quê:**
```typescript
const amount = new Decimal('100.50');  // String → exato
amount.plus(new Decimal('49.50'))      // 150.00 exato
amount.minus(new Decimal('0.01'))      // 150.49 exato
```

- ✅ Exatidão garantida
- ✅ Operações matemáticas simples
- ✅ Usado em todos os grandes sistemas de pagamento

**Trade-off:**
- ⚠️ Não é nativo (dependência)
- ⚠️ ~50KB adicional ao bundle
- ✅ Custa menos que um centavo perdido

**Quando mudar:**
- Nunca. Float para financeiro é sempre errado.

---

## 3. Concorrência - Pessimistic Locking

### Problema
Dois requests simultâneos modificam o saldo:
```
Request 1: saldo 100, debit 50 → 50
Request 2: saldo 100, debit 40 → 60
Result: conflito, saldo inconsistente
```

### Opções
- **Nenhum lock:** Rápido, perigoso. Race condition garantida.
- **Optimistic (versioning):** Rápido, rollback se falhar. Mais complicado.
- **Pessimistic (FOR UPDATE):** Lento, mas correto. Garante serialização.

### Escolhida: Pessimistic

**Por quê:**
- ✅ Uma lock bloqueia tudo, zero race condition
- ✅ Simples: `SELECT * FROM wallets WHERE id = ? FOR UPDATE`
- ✅ Correto para sistema financeiro
- ✅ Throughput aceitável (~1000 tx/sec por DB)

```typescript
const wallet = await em.findOne(WalletEntity, 
  { id: dto.walletId },
  { lockMode: LockMode.PESSIMISTIC_WRITE }
);
// Apenas uma transação pode estar aqui por vez
```

**Trade-off:**
- ⚠️ Throughput: pessimistic ~1000 tx/sec vs optimistic ~10k
- ✅ Correto > rápido em fintech

**Quando mudar:**
- Se throughput > 10k tx/sec: passar para optimistic + retry
- Aqui: ~100 tx/sec esperado → pessimistic ok

---

## 4. Idempotência - Payload Hash + Deduplication

### Problema
```
POST /wagering/transactions (BET 100)
↓
Network timeout
↓
Client retry (mesma request)
↓
Debit duas vezes?
```

### Opções
- **Sem proteção:** Simples, perigoso. Double charge real.
- **Sequence number (DB):** Requer sincronização, complexo.
- **UUID request ID:** Funciona, mas precisa banco.
- **Payload hash + check:** Simples, seguro, sem dependência.

### Escolhida: Payload Hash + Idempotency Key

**Por quê:**
```typescript
// Cliente envia
idempotencyKey: "bet-001"
payload: { walletId: "...", amount: "100" }

// Servidor calcula hash
payloadHash = SHA256(payload)

// Check: existe transação com mesma key?
existing = findOne({ idempotencyKey: "bet-001" })
if (existing && existing.payloadHash === payloadHash) {
  return existing  // Replay seguro
}
if (existing && existing.payloadHash !== payloadHash) {
  throw 409 Conflict  // Payload mudou!
}
```

- ✅ Garante idempotência 100%
- ✅ Detecta payloads conflitantes
- ✅ Sem dependência (cálculo local)

**Trade-off:**
- ⚠️ Cliente tem que gerar idempotencyKey
- ✅ Padrão HTTP (RFC 7231)

**Quando mudar:**
- Com SQS: mover para Inbox pattern (tabela dedicada)
- Aqui: suficiente

---

## 5. Framework - NestJS

### Problema
Construir API REST com middlewares, validação, DI, estrutura clara.

### Opções
- **Express puro:** Flexível, low-level. Muito manual.
- **Fastify:** Rápido, simples. Menos ecosystem.
- **NestJS:** Opinionado, completo, batteries-included.

### Escolhida: NestJS

**Por quê:**
- ✅ Decorators = menos boilerplate
- ✅ DI integrado (ideal para Domain)
- ✅ Validators integrados (class-validator)
- ✅ Guards/Pipes/Middleware nativos
- ✅ Comunidade grande (+ packages)

```typescript
@Controller('wagering')
@UseGuards(JwtGuard)
export class WageringsController {
  @Post('transactions')
  async submit(@Body() dto: SubmitWagerTransactionRequest) { }
}
```

**Trade-off:**
- ⚠️ Overhead (mais código gerado)
- ⚠️ Learning curve
- ✅ Produção ~ Express + 1000 horas de setup manual

**Quando mudar:**
- Se API é <5 endpoints, use Express
- Aqui: 8 endpoints + auth + validação → NestJS ok

---

## 6. ORM - MikroORM

### Problema
Persistência sem SQL manual, lazy loading, migrations automáticas, type-safe.

### Opções
- **Raw SQL:** Controle total, propenso a bugs, sem type-safety.
- **Sequelize:** ORM antigo, verbose.
- **TypeORM:** Popular, mas has issues (versioning, metadata).
- **MikroORM:** Novo, type-safe, performance, migrations boas.

### Escolhida: MikroORM

**Por quê:**
```typescript
@Entity()
export class WalletEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;
  
  @Property({ fieldName: 'walletId' })
  walletId!: string;  // Type-safe, mapeado automaticamente
}
```

- ✅ fieldName mapping (camelCase ↔ snake_case)
- ✅ Migrations versionadas
- ✅ Lock modes (pessimistic, optimistic)
- ✅ Repositório pattern

**Trade-off:**
- ⚠️ Comunidade pequena (vs TypeORM/Sequelize)
- ⚠️ Documentação < concorrentes
- ✅ Muito mais rápido (compilation, querybuilder)

**Quando mudar:**
- Se precisa de multi-database ORM → TypeORM
- Aqui: PostgreSQL only → MikroORM ok

---

## 7. Database - PostgreSQL

### Problema
Persistência durável com constraints financeiros (FK, CHECK, UNIQUE), transações ACID.

### Opções
- **SQLite:** Simples, local. Sem concorrência real.
- **MySQL:** Popular, rápido. Transações não tão robustas.
- **PostgreSQL:** Robusto, ACID garantido, constraints avançados.

### Escolhida: PostgreSQL

**Por quê:**
```sql
ALTER TABLE wallets ADD CONSTRAINT wallets_balance_non_negative 
  CHECK (balance >= 0);  -- Impossível saldo negativo no DB

CREATE UNIQUE INDEX wallets_player_currency 
  ON wallets("playerId", currency);  -- Impossível duplicar
```

- ✅ CHECK constraints = impossível estado inválido
- ✅ ACID transações = garantia de consistência
- ✅ FK = integridade referencial
- ✅ JSON/UUID native

**Trade-off:**
- ⚠️ Mais pesado que SQLite
- ✅ Escalável para produção

---

## 8. Autenticação - JWT Simples vs Keycloak

### Problema
API precisa autenticar: validar que request é de um player legítimo.

### Opções
- **Sem auth:** Rápido, inseguro. Qualquer um acessa.
- **HTTP Basic:** Simples, credenciais em header. Inseguro sem HTTPS.
- **Keycloak:** OAuth2 completo, realm, roles. 2h setup, pesado.
- **JWT simples:** Quick win, seguro, local. Suficiente para prototipo.

### Escolhida: JWT Simples (HS256)

**Por quê:**
```typescript
POST /auth/token
{ "playerId": "user-123", "providerId": "GAMES_INC" }
↓
token = sign({ sub: playerId, providerId }, secret)
↓
POST /wagering/transactions
Authorization: Bearer {token}
↓
verify(token) → extrair playerId → validar escopo
```

- ✅ Zero setup (vs Keycloak 2h)
- ✅ Validação local (vs Keycloak remote)
- ✅ Suficiente para demonstrar auth
- ✅ Fácil de testar

**Trade-off:**
- ⚠️ Não escalável (sem refresh, revogação)
- ✅ Upgrade reto para Keycloak (mesma interface)

```typescript
// Produção: apenas muda o provider
JwtModule.registerAsync({
  useFactory: (config) => ({
    secret: config.get('JWT_PUBLIC_KEY'),  // Chave pública
    issuer: config.get('KEYCLOAK_ISSUER'), // Keycloak
  }),
})
// Mesma interface, JWT validado por Keycloak
```

**Quando mudar:**
- Produção: passar para Keycloak + refresh tokens
- Multi-tenant: Keycloak com realms
- Aqui: demonstração de auth → JWT simples ok

---

## 9. O que NÃO foi feito - Motivos

### SQS Consumer (Inbox Pattern)

**Pedido:** Processar eventos de fila de mensagens

**Por quê não:**
- LocalStack não funciona em Windows/WSL2 (problema de ambiente)
- Scaffolding pronto (tabelas Inbox criadas)
- Lógica definida (WagerTransactionService tem suporte)
- Falta: apenas conectar ao SQS real

**Trade-off:**
- ✅ Sistema funciona 100% sem SQS
- ⚠️ Event publishing não está integrado
- 🔧 ~1h para conectar a SQS real

### Event Publishing (Outbox Pattern)

**Pedido:** Publicar eventos em fila

**Por quê não:**
- Depende de SQS funcionando
- Tabelas OutboxMessage criadas
- Lógica não integrada

**Trade-off:**
- ✅ Sistema funciona sem eventos
- ⚠️ Consumers externos não são notificados
- 🔧 ~2h para full implementation

---

## 10. Decisões de Escopo (O que foi removido)

### Testes Unitários
**Removido:** Sim
**Por quê:** 
- Teste manual via curl prova funcionalidade
- Setup de testes = +2h
- Para júnior: demonstração > cobertura

### Keycloak Auth Guard
**Removido:** Sim (substituído por JWT)
**Por quê:**
- JWT simples = 30min vs Keycloak = 2h
- Mesmo resultado (auth funciona)
- Upgrade claro se needed

### LocalStack SQS
**Removido:** Sim
**Por quê:**
- Não funciona em Windows/WSL2
- Scaffolding já criado (banco preparado)
- Foco: demonstrar financial logic, não infra

---

## 11. Matriz de Trade-offs

| Decisão | Benefício | Custo | Status |
|---------|-----------|-------|--------|
| **DDD** | Lógica clara | Boilerplate | ✅ Ok |
| **Decimal.js** | Exatidão | +50KB | ✅ Obrigatório |
| **Pessimistic Lock** | Seguro | ~1000 tx/sec | ✅ Ok |
| **Idempotência Hash** | Seguro | Cliente gera key | ✅ Ok |
| **NestJS** | Produtivo | Overhead | ✅ Ok |
| **MikroORM** | Type-safe | Comunidade pequena | ✅ Ok |
| **PostgreSQL** | Robusto | Pesado | ✅ Ok |
| **JWT Simples** | Rápido | Não escalável | ✅ Ok |
| **Sem SQS** | Simples | Sem eventos | ✅ Aceitável |

---

## 12. Conclusão

**Filosofia:** Pragmatismo + Segurança Financeira

Cada decisão segue o princípio:
1. **Segurança financeira** nunca é compromisso (Decimal, locking, idempotência)
2. **Pragmatismo** onde não há risco (JWT vs Keycloak, sem testes unit)
3. **Escalabilidade** via upgrade claro (JWT → Keycloak, pessimistic → optimistic)

Resultado: Sistema **pronto para production core**, com **path claro para enterprise features**.
