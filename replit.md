# CO-Finance — Centro de Comando Financeiro

## Overview

CO-Finance é um aplicativo web de finanças pessoais em português brasileiro. Gerencia cartões de crédito, faturas, contas a pagar/receber, contas bancárias, pessoas/empresas, categorias e possui um copiloto IA integrado.

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Architecture

### Artifacts
- `artifacts/api-server` — Express 5 REST API server (port 8080, prefix `/api`)
- `artifacts/finagent` — React + Vite frontend (root path `/`)
- `artifacts/mockup-sandbox` — Component preview server for design work

### Libraries
- `lib/api-spec` — OpenAPI spec (`openapi.yaml`) + Orval codegen
- `lib/api-zod` — Generated Zod schemas from OpenAPI spec
- `lib/api-client-react` — Generated React Query hooks for all endpoints
- `lib/db` — Drizzle ORM schema + PostgreSQL client

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (zod/v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Auth**: Clerk (multi-tenant by profile)
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui
- **Charts**: Recharts
- **Build**: esbuild (ESM bundle)

## Database Schema (13 tables)

- `profiles` — Multi-tenant profiles (tied to clerkUserId)
- `categories` — Income/expense categories with color + icon
- `commitment_types` — Payment commitment types
- `persons` — People and companies (CPF/CNPJ)
- `bank_accounts` — Bank accounts with balance tracking
- `credit_cards` — Credit cards with limit, closing/due days
- `card_installments` — Installment purchase plans (generated on import)
- `invoices` — Monthly card invoices
- `card_transactions` — Individual card transactions (supports installments)
- `accounts_payable` — Bills to pay
- `accounts_receivable` — Bills to receive
- `import_logs` — Log of CSV/OFX imports
- `category_rules` — Auto-categorization rules for transaction matching

## API Routes (all under `/api` prefix)

- `/api/profiles` — CRUD + Clerk user isolation
- `/api/categories` — CRUD per profile
- `/api/commitment-types` — CRUD per profile
- `/api/persons` — CRUD (person/company with CPF/CNPJ)
- `/api/bank-accounts` — CRUD with balance
- `/api/credit-cards` — CRUD with limit/closing/due days
- `/api/invoices` — Read-only (created via import or manually)
- `/api/card-transactions` — CRUD + POST `/import` (CSV/OFX)
- `/api/accounts-payable` — CRUD + POST `/:id/pay`
- `/api/accounts-receivable` — CRUD + POST `/:id/receive`
- `/api/import-logs` — Read-only
- `/api/category-rules` — CRUD
- `/api/dashboard/summary` — KPI aggregation
- `/api/dashboard/recent-transactions` — Last N card transactions
- `/api/dashboard/cash-flow` — 12-month income/expenses
- `/api/dashboard/upcoming-bills` — Bills due in next 30 days
- `/api/dashboard/category-breakdown` — Category pie chart data
- `/api/ai/chat` — AI copilot (OpenRouter)

## Frontend Pages

- `/` — Landing page (signed out) or redirect to `/dashboard`
- `/dashboard` — Financial overview with KPIs and charts
- `/credit-cards` — Card CRUD, invoice management, CSV/OFX import, manual transactions, invoice close/reopen, category assignment, card analysis tab
- `/bank-accounts` — Account list with balance tracking
- `/accounts-payable` — Bills to pay with filters and pay action
- `/accounts-receivable` — Bills to receive with filters and receive action
- `/persons` — People and companies directory
- `/categories` — Category management + auto-categorization rules
- `/reports` — 12-month cash flow charts + category breakdown
- `/ai-copilot` — Chat with AI copilot (Portuguese)

## Themes

4 themes via CSS custom properties:
- `theme-dark-blue` (default) — Dark background, blue accent
- `theme-dark-green` — Dark background, green accent
- `theme-light-blue` — Light background, blue accent
- `theme-light-green` — Light background, green accent

## Deployment Notes

- **CORS**: The API server uses an explicit origin allowlist. At deploy time, set `ALLOWED_ORIGINS=https://your-app.replit.app` to allow the frontend to call the API. The `REPLIT_DEV_DOMAIN` env var is auto-set for dev previews.
- **Clerk**: Set `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `CLERK_PROXY_URL` (pointing to the API's Clerk proxy path) in deployment environment.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## CSV/OFX Import

The import parser supports:
- Nubank-style CSV: `date,title,amount`
- Standard PT-BR CSV with `;` separator
- OFX with `<STMTTRN>` blocks
- Auto-detects installments via regex (PARC/PAR N/M patterns)
- Auto-categorizes via CategoryRules (text matching)
- Creates/updates invoice and linked AccountPayable

## AI Copilot

Endpoint: `POST /api/ai/chat`
Model: `google/gemini-flash-1.5` via OpenRouter
Requires env var: `OPENROUTER_API_KEY`
Context: Fetches real financial data (payables, receivables, card expenses, top categories) to provide personalized answers.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
