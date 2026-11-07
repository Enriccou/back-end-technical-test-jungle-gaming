# Autenticação - Arquitetura de Decisão

## Visão Geral

O sistema implementa autenticação baseada em **JWT simples (HS256)** ao invés de um servidor OAuth2 completo como Keycloak.

## Por que JWT simples?

### Keycloak (Complexidade alta)
- ❌ Requer configuração de Realm, Clients, Roles, Mappers
- ❌ Necessita sincronização de tokens entre API e servidor
- ❌ Requer validação de assinatura contra JWKS endpoint remoto
- ❌ Maior latência (verificação remota a cada request)
- ❌ Overhead de configuração para um teste técnico júnior

### JWT Simples (Pragmático)
- ✅ Zero configuração de servidores
- ✅ Validação local (rápida)
- ✅ Fácil de testar manualmente
- ✅ Apropriado para prototipos e testes técnicos

## Fluxo de Autenticação

### 1. Emitir Token
```bash
POST /auth/token
{
  "playerId": "550e8400-e29b-41d4-a716-446655440001",
  "providerId": "GAMES_INC"
}

Response:
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer"
}
```

### 2. Usar Token
```bash
GET /wallets/:id
Authorization: Bearer eyJhbGc...
```

### 3. Guard Valida
```typescript
@UseGuards(JwtGuard)
async getWallet(@Request() req) {
  const playerId = req.user.sub;  // Extraído do token
  // Operação autorizada
}
```

## Segurança

### Implementado
- ✅ Claims validados (playerId, providerId)
- ✅ Expiração (24h)
- ✅ Validação de escopo (não pode bet para outro player)
- ✅ Secret configurável via .env

### Não implementado (seria em produção)
- ❌ HTTPS obrigatório
- ❌ Token refresh
- ❌ Rate limiting por token
- ❌ Revogação de tokens
- ❌ Audit log de autenticações

## Para Produção

Passar para Keycloak/OAuth2 adicionando:

```typescript
// app.module.ts
JwtModule.registerAsync({
  useFactory: async (configService: ConfigService) => ({
    secret: configService.get('JWT_PUBLIC_KEY'),  // Chave pública
    issuer: configService.get('KEYCLOAK_ISSUER'),
    audience: 'account',
  }),
})
```

Seria um upgrade reto: guardar o mesmo token, mas validado contra Keycloak.

## Conclusão

JWT simples é **suficiente para um teste técnico** porque:
1. Demonstra compreensão de autenticação
2. Prova conhecimento de NestJS guards
3. Implementável em 30min
4. Mantém foco no domain (transações, ledger)

Para produção, substituir por Keycloak/OAuth2 sem mudanças na lógica de negócio.
