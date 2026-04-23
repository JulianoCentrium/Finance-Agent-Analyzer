# Co-Finance — Guia de Deploy em Docker Swarm

Este documento descreve como empacotar o monorepo Co-Finance em imagens
Docker e publicá-lo em um cluster **Docker Swarm** fora do Replit.

> Stack contém 4 serviços: `postgres`, `migrator` (one-shot), `api-server`
> (Express bundlado com esbuild) e `web` (SPA Vite servido por nginx, que
> também faz proxy reverso de `/api/*` para o `api-server`).

---

## 1. Visão geral da arquitetura

```
                       ┌───────────────────────────────┐
   internet ─► 80/443  │  Reverse proxy / TLS (Traefik │
                       │  ou Nginx externo — opcional) │
                       └──────────────┬────────────────┘
                                      │  HTTP
                                      ▼
                       ┌───────────────────────────────┐
                       │  service: web (nginx)         │
                       │  porta interna 8080           │
                       │  - SPA estática (dist/public) │
                       │  - /api/*  → api-server:8080  │
                       └──────────────┬────────────────┘
                                      │ overlay net
                                      ▼
                       ┌───────────────────────────────┐
                       │  service: api-server          │
                       │  Node 20, Express bundlado    │
                       │  porta interna 8080           │
                       └──────────────┬────────────────┘
                                      │
                                      ▼
                       ┌───────────────────────────────┐
                       │  service: postgres (volume)   │
                       │  porta interna 5432           │
                       └───────────────────────────────┘

       service: migrator   (run-once: drizzle push + apply-views)
```

Arquivos relevantes (todos em `deploy/`):

| Arquivo | Propósito |
| ------- | --------- |
| `Dockerfile.api-server` | Bundle do backend (esbuild → `dist/index.mjs`) + Node 20 alpine |
| `Dockerfile.web`        | Build do Vite + nginx alpine servindo SPA e proxy `/api` |
| `Dockerfile.migrator`   | Roda `drizzle-kit push` e `apply-views` uma vez por deploy |
| `nginx/default.conf`    | Configuração nginx (SPA fallback, gzip, cache, proxy `/api`) |
| `docker-compose.yml`    | Stack file usado por `docker stack deploy` |
| `.env.example`          | Template das variáveis (copie para `.env`) |
| `build-and-push.sh`     | Script auxiliar para build + push das três imagens |

---

## 2. Pré-requisitos

No servidor (manager do swarm):

- Docker Engine ≥ 24
- `docker swarm init` já executado (`docker info | grep Swarm` mostra `active`)
- Acesso a um registry (Docker Hub, GHCR, GitLab, registry interno…)
- Postgres 16 (via stack) **ou** instância gerenciada externa
- (Opcional, recomendado) Traefik ou Nginx externo terminando TLS na 443

Na máquina onde você vai **buildar** as imagens (pode ser local):

- Docker ≥ 24 (com BuildKit ativo — padrão)
- Conta autenticada no registry: `docker login <REGISTRY>`

---

## 3. Variáveis de ambiente

A tabela abaixo lista **todas** as variáveis usadas pelo projeto após
varredura do código (`process.env.*` e `import.meta.env.*`). Há duas
categorias importantes:

- **Build-time (VITE_\*)**: ficam embutidas no JS do frontend. Precisam
  ser passadas como `--build-arg` na construção da imagem `web`.
  São públicas — qualquer usuário do site consegue ler.
- **Runtime**: lidas no momento da execução (api-server, migrator).
  Ficam no `deploy/.env` (ou em Docker Secrets — ver §8).

| Variável | Onde é usada | Quando | Obrigatória | Observações |
| -------- | ------------ | ------ | ----------- | ----------- |
| `DATABASE_URL` | api-server, migrator, lib/db | runtime | **sim** | Aponta para o serviço `postgres` da stack ou instância externa |
| `CLERK_SECRET_KEY` | api-server (Clerk + proxy) | runtime | **sim** | Mantenha SECRETA. Use Docker Secret em produção (ver §8) |
| `ALLOWED_ORIGINS` | api-server (CORS) | runtime | **sim em prod** | Lista CSV com a origem pública do frontend (ex.: `https://cofinance.suaempresa.com`). Se servir frontend e API pelo mesmo domínio (recomendado), adicione mesmo assim |
| `NODE_ENV` | api-server, build do web | runtime | sim | `production` em deploy real (ativa o Clerk proxy e desliga overlays de dev) |
| `PORT` | api-server | runtime | sim | Porta interna do container. Default `8080`. Não precisa coincidir com a porta exposta |
| `LOG_LEVEL` | api-server (pino) | runtime | não | Default `info`. Use `debug` para troubleshooting |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | postgres | runtime | sim | Só se usar o `postgres` da stack |
| `VITE_CLERK_PUBLISHABLE_KEY` | frontend (App.tsx) | **build-time** | **sim** | Pública. Vai pro bundle. `pk_live_...` em prod |
| `VITE_CLERK_PROXY_URL` | frontend (App.tsx) | **build-time** | sim | Default `/api/__clerk` — bate com `CLERK_PROXY_PATH` no backend |
| `BASE_PATH` | frontend (vite.config.ts) | **build-time** | não | Default `/`. Só altere se servir o SPA num subpath (ex.: `/cofinance/`) |
| `IMAGE_TAG` | compose | deploy-time | sim | Versão das imagens. Use semver (`1.0.0`) em vez de `latest` |
| `REGISTRY` | compose | deploy-time | sim | Prefixo do registry (`ghcr.io/seu-user`) |
| `WEB_PUBLIC_PORT` | compose | deploy-time | não | Porta do host onde o nginx será exposto. Default `8080` |

Variáveis **somente de desenvolvimento no Replit** (NÃO precisam ser
configuradas em produção): `REPLIT_DEV_DOMAIN`, `REPL_ID`, `REPLIT_DOMAINS`.

> ⚠️ A chave da OpenRouter (usada pelo Co-Pilot de IA) **não** é uma
> variável de ambiente. Ela é cadastrada por usuário no banco, em
> Configurações → IA, depois do primeiro login. Não há nada para
> configurar no servidor.

---

## 4. Configurar o ambiente

```bash
# Na máquina de build (ou no manager do swarm — onde você for fazer deploy)
cp deploy/.env.example deploy/.env
$EDITOR deploy/.env
```

Preencha pelo menos:

- `REGISTRY` e `IMAGE_TAG`
- `POSTGRES_PASSWORD` (gere com `openssl rand -base64 32`)
- `DATABASE_URL` consistente com a senha acima
- `CLERK_SECRET_KEY` (`sk_live_...`)
- `VITE_CLERK_PUBLISHABLE_KEY` (`pk_live_...`)
- `ALLOWED_ORIGINS` com a URL pública final do site

> O `deploy/.env` está no `.dockerignore` e **NÃO** entra nas imagens.
> Ainda assim, **não commite** este arquivo.

---

## 5. Build e push das imagens

### Opção A — script (recomendado)

```bash
./deploy/build-and-push.sh                 # usa IMAGE_TAG do .env
./deploy/build-and-push.sh 1.0.1           # ou sobrescreve a tag
```

O script constrói as três imagens (`cofinance-api-server`,
`cofinance-web`, `cofinance-migrator`), aplica também a tag `latest`
e dá `docker push` em todas.

### Opção B — comandos manuais

```bash
# A partir da raiz do repositório:
set -a && . ./deploy/.env && set +a

docker build -f deploy/Dockerfile.api-server \
  -t "$REGISTRY/cofinance-api-server:$IMAGE_TAG" .

docker build -f deploy/Dockerfile.web \
  --build-arg VITE_CLERK_PUBLISHABLE_KEY="$VITE_CLERK_PUBLISHABLE_KEY" \
  --build-arg VITE_CLERK_PROXY_URL="$VITE_CLERK_PROXY_URL" \
  -t "$REGISTRY/cofinance-web:$IMAGE_TAG" .

docker build -f deploy/Dockerfile.migrator \
  -t "$REGISTRY/cofinance-migrator:$IMAGE_TAG" .

docker push "$REGISTRY/cofinance-api-server:$IMAGE_TAG"
docker push "$REGISTRY/cofinance-web:$IMAGE_TAG"
docker push "$REGISTRY/cofinance-migrator:$IMAGE_TAG"
```

> Lembre-se: **trocar `VITE_CLERK_PUBLISHABLE_KEY` exige rebuild da imagem
> `web`** — o valor é embutido no bundle JS.

---

## 6. Deploy no Swarm

No manager do cluster:

```bash
# Inicializa swarm (caso ainda não tenha sido feito):
docker swarm init

# Faça login no registry no manager (necessário se as imagens forem privadas):
docker login <REGISTRY>

# Carregue o .env e faça o deploy:
cd deploy
set -a && . ./.env && set +a
docker stack deploy \
  -c docker-compose.yml \
  --with-registry-auth \
  cofinance
```

Verifique que tudo subiu:

```bash
docker stack services cofinance
docker stack ps cofinance --no-trunc
docker service logs cofinance_api-server --tail 100 -f
docker service logs cofinance_web         --tail 100 -f
docker service logs cofinance_migrator    --tail 100
```

O serviço `migrator` deve aparecer com `1/1` por alguns segundos e depois
ficar `0/1` (estado normal — `restart_policy: condition: none` faz com que
ele só rode uma vez por deploy).

A aplicação deve responder em `http://<host-do-swarm>:${WEB_PUBLIC_PORT}`.

---

## 7. Atualizações (rolling updates)

```bash
# 1. Build + push da nova versão
./deploy/build-and-push.sh 1.0.1
# 2. Atualizar IMAGE_TAG no .env (ou exportar inline)
IMAGE_TAG=1.0.1 docker stack deploy \
  -c deploy/docker-compose.yml \
  --with-registry-auth \
  cofinance
```

O compose já tem `update_config: order: start-first` + `failure_action:
rollback` para api-server e web, garantindo zero downtime e rollback
automático em caso de falha.

Para forçar o `migrator` a rodar de novo (ex.: após mudanças no schema):

```bash
docker service update --force cofinance_migrator
```

---

## 8. Boas práticas: Docker Secrets em vez de env vars (opcional)

Em produção, recomenda-se mover **`POSTGRES_PASSWORD`** e
**`CLERK_SECRET_KEY`** para Docker Secrets. Exemplo:

```bash
printf '%s' 'sk_live_xxx...' | docker secret create cofinance_clerk_secret -
printf '%s' 'senha-postgres'  | docker secret create cofinance_postgres_pw -
```

E no `docker-compose.yml`:

```yaml
secrets:
  cofinance_clerk_secret:
    external: true
  cofinance_postgres_pw:
    external: true

services:
  api-server:
    secrets:
      - cofinance_clerk_secret
    environment:
      # Lê o secret do arquivo montado em /run/secrets/<nome>
      CLERK_SECRET_KEY_FILE: /run/secrets/cofinance_clerk_secret
```

Nesse caso, é preciso adaptar o backend para ler `*_FILE` quando
presente — ou usar um wrapper de entrypoint que faça
`export CLERK_SECRET_KEY="$(cat $CLERK_SECRET_KEY_FILE)"` antes de
iniciar o Node. Para começar, manter no `.env` é aceitável desde que o
arquivo tenha permissões restritas (`chmod 600 deploy/.env`).

---

## 9. TLS / domínio público

O serviço `web` expõe HTTP simples na porta `WEB_PUBLIC_PORT`. Em produção
você quase sempre quer HTTPS. Duas opções comuns:

### a) Traefik (no próprio swarm)

Adicione um serviço `traefik` ouvindo 80/443 com Let's Encrypt e use
labels no `web` para roteamento TLS. Nesse caso remova `ports:` do `web`
e mantenha somente a rede overlay compartilhada.

### b) Nginx/Caddy externo

Mantenha como está, e ponha um nginx/caddy num host público encaminhando
443 → `host-do-swarm:WEB_PUBLIC_PORT`. Garanta que esse proxy externo
encaminhe `X-Forwarded-Proto: https`, pois o `clerkProxyMiddleware` usa
esse header para construir a URL do proxy do Clerk.

---

## 10. Backup do Postgres

```bash
# Dump
docker exec $(docker ps -qf name=cofinance_postgres) \
  pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > backup-$(date +%F).sql.gz

# Restore
gunzip -c backup-2026-04-22.sql.gz | docker exec -i \
  $(docker ps -qf name=cofinance_postgres) \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Recomenda-se cron diário + retenção e snapshot do volume `postgres_data`.

---

## 11. Troubleshooting

| Sintoma | Causa provável | Como resolver |
| ------- | -------------- | ------------- |
| Frontend abre mas pede login eternamente | `VITE_CLERK_PUBLISHABLE_KEY` errada/`pk_test_*` em prod | Rebuild da imagem `web` com a chave correta |
| `Not allowed by CORS` no console do navegador | `ALLOWED_ORIGINS` não bate com a URL pública | Ajuste a env e `docker stack deploy` de novo |
| `migrator` falha com "DATABASE_URL is required" | `.env` não exportado antes do `stack deploy` | Use `set -a && . ./.env && set +a` antes do comando |
| api-server reinicia em loop com `Invalid PORT value` | `PORT` foi removido | Mantenha `PORT=8080` no `.env` |
| Logs do Clerk com erro 401 ao chamar `/api/__clerk/*` | `CLERK_SECRET_KEY` errada ou ausente | Verifique a env no service: `docker service inspect cofinance_api-server --pretty` |
| Build da imagem `web` mostra `pk_undefined` no bundle | Esqueceu o `--build-arg` | Use `./deploy/build-and-push.sh` ou o comando completo da §5B |

Logs em tempo real:

```bash
docker service logs cofinance_api-server -f --tail 200
docker service logs cofinance_web        -f --tail 200
```

Inspecionar variáveis efetivamente injetadas em um service:

```bash
docker service inspect cofinance_api-server --format '{{json .Spec.TaskTemplate.ContainerSpec.Env}}' | jq
```

---

## 12. Remover a stack

```bash
docker stack rm cofinance
# o volume postgres_data é PRESERVADO. Para apagar tudo:
docker volume rm cofinance_postgres_data
```
