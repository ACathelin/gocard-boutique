# GoCard Boutique

A standalone, plug-and-play reference implementation of an **agentic-commerce-ready storefront**, built on:

- **Worldline GoPay Direct** — hosted checkout
- **Claude (Anthropic)** — AI shopping concierge
- **Cloudflare Turnstile** — bot protection on write routes
- **Postgres + Redis** — catalog, payment logs, session quotas

The storefront sells a curated set of 12 VIP experiences under the **GoCard** brand — a private lifestyle membership. It's designed as a clean seam for swapping the internal Claude concierge for a real MCP client later (see `server/services/agentBridge.js`).

---

## Quick start

```bash
cp .env.example .env
# (optional) fill WORLDLINE_* creds for real checkout, ANTHROPIC_API_KEY for the concierge
docker compose up --build
```

Open http://localhost:3000 — you should see the 12-card grid under a serif hero. First boot runs migrations automatically.

**Test card:** `4111 1111 1111 1111`, any future expiry, any CVV.

---

## Architecture

```
┌──────────────────┐       ┌──────────────────┐
│  web/ (Vite SPA) │──────▶│  server/ (Node)  │
│  Tailwind, React │   /api│  Express, pg     │
│  react-router    │       │  ioredis, pino   │
└──────────────────┘       └─────────┬────────┘
                                     │
        ┌────────────────────────────┼────────────────────────┐
        ▼                            ▼                        ▼
   ┌─────────┐                  ┌─────────┐            ┌──────────────┐
   │ Postgres│                  │  Redis  │            │  Worldline + │
   │ catalog │                  │ quotas  │            │  Anthropic   │
   │ logs    │                  │ cache   │            └──────────────┘
   └─────────┘                  └─────────┘
```

In **dev**: `web` runs on :5173 and proxies `/api/*` to `server` on :3000.
In **prod** (docker): `server` serves the built SPA from `web/dist` alongside the API on :3000.

---

## Environment variables

| Name | Required? | What it does |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection URL |
| `REDIS_URL` | no | Redis URL; falls back to in-memory if unset |
| `WORLDLINE_MERCHANT_ID` / `WORLDLINE_API_KEY` / `WORLDLINE_SECRET_KEY` | for checkout | GoPay Direct credentials |
| `WORLDLINE_HOST` | no | Default: `payment.preprod.direct.worldline-solutions.com` |
| `WORLDLINE_ENVIRONMENT` | no | `test` or `production` |
| `ANTHROPIC_API_KEY` | no | Enables the Claude concierge; without it, the chat endpoint returns a canned reply |
| `TURNSTILE_SECRET_KEY` + `VITE_TURNSTILE_SITE_KEY` | no | Enables Cloudflare Turnstile on `/chat` + `/checkout`; dev mode lets you run without |
| `JWT_SECRET` | no | Enables optional Bearer-token auth on `/chat` and `/checkout` |
| `FRONTEND_URL` | no | Where Worldline redirects customers after checkout (default: `http://localhost:3000`) |
| `PORT` | no | Default: 3000 |
| `NODE_ENV` | no | `production` serves the built SPA; `development` runs API-only |
| `LOG_LEVEL` | no | `info`, `debug`, etc. |

---

## Feature flags

Seeded in `migrations/002_seed.sql`. The `GET /api/system/public-feature-flags/:name` endpoint exposes them to the frontend.

| Flag | Default | What it gates |
|---|---|---|
| `boutique_public_enabled` | on | Master switch — disables the homepage if off |
| `boutique_chat_enabled` | on | Concierge chat panel + `/api/boutique/chat` |
| `boutique_payments_enabled` | on | Checkout drawer + `/api/boutique/checkout` |
| `boutique_turnstile_required` | on | Forces Turnstile verification on chat + checkout |
| `boutique_vic_enabled` | on | Advertises Visa Intelligent Commerce support in `/capabilities` |
| `boutique_mc_agentpay_enabled` | on | Advertises Mastercard Agent Pay support |
| `boutique_visa_trusted_agent_enabled` | off | (Not implemented in this standalone build) |
| `boutique_mc_trusted_agent_enabled` | off | (Not implemented in this standalone build) |

---

## API endpoints

Under `/api/boutique`:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/capabilities` | Which payment methods + networks are advertised |
| `GET` | `/products` | Paginated catalog (filters: `category`, `search`) |
| `GET` | `/products/:id` | Single product with images + inventory |
| `GET` | `/categories` | Active categories |
| `POST` | `/chat` | Claude concierge — rate-limited, Turnstile-protected |
| `POST` | `/checkout` | Create Worldline hosted checkout — rate-limited, Turnstile-protected |
| `GET` | `/payment-status/:hostedCheckoutId` | Poll Worldline for payment status |

Plus `GET /health` and `GET /api/system/public-feature-flags/:name`.

---

## What's intentionally excluded

This repo is a trimmed extract of the feature as it exists in a larger monorepo. These features were dropped to keep the codebase small and the dependency tree minimal:

- **x402 payments** — the HTTP 402 agent-payment discovery endpoints
- **Trusted Agent mandates** (Visa / Mastercard) — the HS256-signed intent tokens
- **MCP tool-invocation audit log** — per-tool-call tracking table
- **JSON Schema endpoints** for `/chat` and `/checkout`
- **GraphQL subscriptions** for real-time payment events

The seam for swapping the internal concierge for a real MCP server is `server/services/agentBridge.js` — its `sendTurn(...)` signature is stable, and today it just delegates to the bundled `boutiqueAssistantService`. Tomorrow it can forward to an MCP client without touching anything else.

---

## Development

```bash
npm install              # install all workspaces
npm run dev              # Vite on :5173 + nodemon'd server on :3000 (Vite proxies /api)
npm run migrate          # run DB migrations against the configured DATABASE_URL
npm run build            # build the web SPA into web/dist
npm run start            # start the server in production mode
```

---

## License

MIT — see [LICENSE](./LICENSE).
