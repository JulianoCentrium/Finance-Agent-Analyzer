# ✅ Sistema de Autenticação Refatorado - Sem Clerk

## 📋 Resumo das Mudanças

Substituímos completamente o Clerk por um sistema de autenticação local com:
- **Backend**: Node.js + Express com JWT
- **Banco de Dados**: PostgreSQL com tabela `auth` (email + senha hash)
- **Frontend**: React com contexto local (AuthContext)
- **Segurança**: bcryptjs para hash de senhas, JWT com expiração

---

## 🔄 Arquivos Modificados

### Backend
- ✅ `artifacts/api-server/src/app.ts` - Removeu clerkMiddleware
- ✅ `artifacts/api-server/src/routes/auth.ts` - Nova rota de autenticação (create)
- ✅ `artifacts/api-server/src/routes/index.ts` - Adicionou auth router
- ✅ `artifacts/api-server/src/routes/users.ts` - Usa authId em vez de clerkUserId
- ✅ `artifacts/api-server/src/lib/auth-local.ts` - Novos utilitários (create)
- ✅ `artifacts/api-server/src/lib/auth.ts` - Atualizado para authId
- ✅ `artifacts/api-server/src/middlewares/authMiddleware.ts` - Novo middleware JWT (create)
- ✅ `artifacts/api-server/package.json` - Removeu @clerk, adicionou bcryptjs + jsonwebtoken

### Banco de Dados
- ✅ `lib/db/src/schema/auth.ts` - Nova tabela de autenticação (create)
- ✅ `lib/db/src/schema/index.ts` - Exporta auth schema
- ✅ `lib/db/migrations/0004_add_auth_table.sql` - Migração SQL (create)

### Frontend
- ✅ `artifacts/finagent/src/App.tsx` - Removeu ClerkProvider
- ✅ `artifacts/finagent/src/contexts/AuthContext.tsx` - Novo contexto local (create)
- ✅ `artifacts/finagent/src/pages/login.tsx` - Nova página de login (create)
- ✅ `artifacts/finagent/src/pages/register.tsx` - Nova página de registro (create)
- ✅ `artifacts/finagent/package.json` - Removeu @clerk/react

### Configuração
- ✅ `.env.local` - Removeu VITE_CLERK_* e Clerk credentials
- ✅ `deploy/Dockerfile.web` - Removeu ARG VITE_CLERK_*
- ✅ `deploy-local-v2.ps1` - Removeu build args do Clerk

---

## ⚙️ Como Usar

### 1️⃣ Primeiro Acesso (Setup)
```
POST /api/auth/register
{
  "email": "admin@example.com",
  "password": "senha123"
}

Resposta:
{
  "success": true,
  "token": "jwt_token_aqui",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "isAdmin": true,        ← Primeiro usuário é sempre admin!
    "isFirstUser": true
  }
}
```

A senha vai ser gerada como admin automaticamente!

### 2️⃣ Próximos Usuários
```
POST /api/auth/register
{
  "email": "usuario@example.com",
  "password": "senha456"
}

Resposta (isAdmin: false):
{
  "success": true,
  "token": "jwt_token_aqui",
  "user": {
    "id": 2,
    "email": "usuario@example.com",
    "isAdmin": false
  }
}
```

### 3️⃣ Login Padrão
```
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "senha123"
}

Headers retornados (usar em todas requisições):
Authorization: Bearer <token>
```

### 4️⃣ Endpoints de Autenticação


| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/auth/setup` | GET | Verifica se setup é necessário (sem usuários) |
| `/api/auth/register` | POST | Registra novo usuário |
| `/api/auth/login` | POST | Faz login |
| `/api/auth/me` | GET | Get usuário atual (requer auth) |
| `/api/auth/logout` | POST | Logout (client-side, token é removido) |

---

## 🔐 Fluxo de Autenticação

```
1. Usuário acessa http://localhost:8190
   ↓
2. Frontend redireciona para /login
   ↓
3. Clica em "Criar conta"
   ↓
4. POST /api/auth/register com email + senha
   ↓
5. Backend:
   - Verifica se email já existe
   - Hash a senha com bcryptjs
   - Cria registro na tabela `auth`
   - Gera JWT token
   ↓
6. Frontend:
   - Armazena token em localStorage
   - Armazena user data em localStorage
   - Redireciona para /dashboard
   ↓
7. Todas requisições à API têm header:
   Authorization: Bearer <token>
   ↓
8. Backend valida JWT em cada requisição
```

---

## 🚀 Deploy Local

```bash
# 1. Instalar dependências novas
cd c:\Finance-Agent-Analyzer
pnpm install

# 2. Rodar deploy
.\deploy-local-v2.ps1

# 3. Acessar
http://localhost:8190

# 4. Criar primeira conta (será admin)
Email: admin@example.com
Senha: MinhaSenh123
```

---

## 🔒 Segurança

- ✅ Senhas com hash bcrypt (2^10 rounds)
- ✅ JWT com expiração (7 dias)
- ✅ Middleware JWT em todas rotas protegidas
- ✅ CORS validado
- ✅ Sem exposição de senhas em logs

⚠️ **Produção**: Mudar `JWT_SECRET` em `.env`!

---

## 📝 Variáveis de Ambiente

**Backend necessita:**
```
DATABASE_URL=postgres://...
NODE_ENV=development|production
JWT_SECRET=sua-chave-secreta-aqui  ← IMPORTANTE!
ALLOWED_ORIGINS=http://localhost:8190
```

**Frontend (não precisa):**
- Sem variáveis Clerk
- Tudo é dinâmico via API

---

## ✅ Próximas Etapas (Opcionais)

- [ ] Adicionar reset de senha
- [ ] Adicionar 2FA (Two-Factor Auth)
- [ ] Adicionar gerenciamento de usuários (admin)
- [ ] Adicionar refresh tokens
- [ ] Migrar clerkUserId para authId em outras tabelas

---

## 🆘 Troubleshooting

**Erro "Email já registrado"**
→ Use outro email ou delete o registro do banco

**Erro "Invalid token"**
→ Token expirou (7 dias) - faça login novamente

**Erro CORS**
→ Verifique ALLOWED_ORIGINS no .env

**Erro na migração**
→ Execute manualmente em banco (ver 0004_add_auth_table.sql)
