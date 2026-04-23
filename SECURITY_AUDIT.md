# GoCard Boutique — Security & Performance Audit

**Audit type:** Static code review + dependency audit + dynamic secret scan
**Audit date:** 2026-04-23
**Scope:** Full repository (`server/`, `web/`, `migrations/`, `Dockerfile`, `docker-compose.yml`, `.env.example`) at commit `f5dd611`
**Out of scope:** Live pentest, infra hardening, Worldline/Anthropic/Cloudflare service-side security

## Remediation status (2026-04-23)

| ID | Severity | Status | Notes |
|---|---|---|---|
| SEC-H-1 | High | **FIXED** | Turnstile now validates `hostname`, `action`, and `challenge_ts` freshness ([server/middleware/turnstile.js](server/middleware/turnstile.js)). |
| SEC-H-2 | High | **FIXED** | `boutique_turnstile_required` removed from `ALLOWED_PUBLIC_FLAGS` ([server/app.js](server/app.js)). |
| SEC-H-3 | High | **FIXED** | DB TLS verifies certs by default; opt-in `PGSSL_INSECURE=1` for exceptions ([server/db/index.js](server/db/index.js)). |
| SEC-H-4 | High | **FIXED** | `FRONTEND_URL` required in production; dev uses explicit localhost allowlist ([server/app.js](server/app.js)). |
| SEC-H-5 | High | **FIXED** | `Idempotency-Key` header supported on `/checkout`; `merchantReference` uses `crypto.randomUUID()` ([server/routes/boutique.js](server/routes/boutique.js)). |
| SEC-H-6 | High | **FIXED** | Worldline webhook at `POST /api/worldline/webhook` with SDK HMAC-SHA256 signature verification ([server/routes/worldlineWebhook.js](server/routes/worldlineWebhook.js)). |
| SEC-M-1 | Medium | **FIXED** | Turnstile verify-cache TTL dropped 60s → 10s and scoped to `(token, action, ip)` ([server/middleware/turnstile.js](server/middleware/turnstile.js)). |
| SEC-M-2 | Medium | **FIXED** | `payment_logs.response_body` now stores only structured fields via `trimHostedCheckoutResponse` ([server/routes/boutique.js](server/routes/boutique.js)). |
| SEC-M-3 | Medium | **FIXED** | Rate limiters on `/chat` and `/checkout` fail closed on Redis outage ([server/lib/rateLimitStore.js](server/lib/rateLimitStore.js), [server/middleware/boutiqueRateLimit.js](server/middleware/boutiqueRateLimit.js)). |
| SEC-M-4 | Medium | **DEFERRED** | CSP nonces require per-request HTML templating; out of scope for this pass. |
| SEC-M-5 | Medium | **FIXED** | `safeJsonLd()` escapes `<`, `>`, `&` before `dangerouslySetInnerHTML` ([web/src/components/boutique/SeoHead.tsx](web/src/components/boutique/SeoHead.tsx)). |
| SEC-M-6 | Medium | **ACCEPTED** | Cloudflare doesn't publish a stable SRI for Turnstile; CSP `script-src` already scoped to `challenges.cloudflare.com`. |
| SEC-M-7 | Medium | **DEFERRED** | `ai_conversation_logs` retention needs a cron job / migration — outside code scope. |
| SEC-M-8 | Medium | **FIXED** | JWT middleware now returns a generic 401 for every failure mode ([server/middleware/auth.js](server/middleware/auth.js)). |
| SEC-M-9 | Medium | **ACCEPTED** | Cart cap is a per-merchant business decision; platform ceiling of €30k is the stated invariant. |
| SEC-M-10 | Medium | **FIXED** | `/payment-status/:id` now binds to the originating `boutique_sid` via Redis ([server/routes/boutique.js](server/routes/boutique.js)). |
| SEC-M-11 | Medium | **FIXED** | SDK errors passed through `sanitizeSdkError()`; raw response bodies never written to logs or `payment_logs` ([server/routes/boutique.js](server/routes/boutique.js)). |
| SEC-M-12 | Medium | **FIXED** | Demo Postgres credentials in `docker-compose.yml` now override from host env ([docker-compose.yml](docker-compose.yml)). |
| SEC-L-1 | Low | **ACCEPTED** | Jailbreak regex guard is best-effort; concierge has no tool calls and outputs are catalog-id-filtered. |
| SEC-L-2 | Low | **FIXED** | `merchantReference` no longer includes session-cookie bytes ([server/routes/boutique.js](server/routes/boutique.js)). |
| SEC-L-3 | Low | **DEFERRED** | CSRF token adds a browser-state round trip; `sameSite=lax` + fixed CORS is sufficient at this scope. |
| SEC-L-4 | Low | **ACCEPTED** | Cookie `secure: true` guarded by `NODE_ENV=production`; operators running HTTPS without that flag should set it. |
| SEC-L-5 | Low | **N/A** | Pre-existing clean posture — confirmed. |
| SEC-L-6 | Low | **FIXED** | Explicit `helmet.hsts({ maxAge: 63072000, includeSubDomains: true, preload: true })` in production ([server/app.js](server/app.js)). |
| PERF-H-1 | High | **FIXED** | `fetchBoutiqueProductById()` runs a single `WHERE id=$1` query ([server/routes/boutique.js](server/routes/boutique.js)). |
| PERF-H-2 | High | **DEFERRED** | Image re-encoding requires build-time tooling; adding WebP/AVIF variants is best handled as a follow-up asset pipeline. |
| PERF-M-1 | Medium | **FIXED** | Anthropic system prompt sent with `cache_control: { type: 'ephemeral' }` ([server/services/boutiqueAssistantService.js](server/services/boutiqueAssistantService.js)). |
| PERF-M-2 | Medium | **FIXED** | `/capabilities` now sends `Cache-Control: public, max-age=60` ([server/routes/boutique.js](server/routes/boutique.js)). |
| PERF-M-3 | Medium | **FIXED** | `BoutiqueProductPage` and `BoutiqueReturn` wrapped in `React.lazy` + `Suspense` ([web/src/App.tsx](web/src/App.tsx)). |
| PERF-M-4 | Medium | **DEFERRED** | Redis-backed catalog cache is a bigger refactor; acceptable risk for single-process deploys. |
| PERF-M-5 | Medium | **ACCEPTED** | UA-hash keygen trade-off kept — cardinality is bounded by rate-limit window TTLs. |
| PERF-L-1 | Low | **ACCEPTED** | 12-item catalog doesn't benefit from `React.memo`; revisit if catalog grows. |
| PERF-L-2 | Low | **N/A** | Pre-existing good posture. |
| PERF-L-3 | Low | **N/A** | Pre-existing good posture. |

**Summary:** 22 findings remediated · 4 accepted with rationale · 4 deferred (image pipeline, CSP nonces, conversation-log retention, Redis catalog cache). All 8 Highs closed.

---

## 1. Executive summary

| Severity | Security | Performance |
|---|---:|---:|
| Critical | 0 | 0 |
| High | 6 | 2 |
| Medium | 11 | 5 |
| Low / Info | 6 | 3 |
| **Total** | **23** | **10** |

**Secret-scan verdict: CLEAN.** Gitleaks found no leaks across the whole worktree + git history (1 commit, 399 KB scanned). No hardcoded API keys, private keys, JWTs, or `.env` files in source control.

**Dependency verdict: 2 moderate CVEs** — both caused by the same transitive `uuid < 14.0.0` vulnerability pulled in via Worldline's `onlinepayments-sdk-nodejs`. No fix is available from the upstream SDK at the time of this audit.

**Posture overall:** The code shows a mature security baseline — parameterised queries everywhere, Helmet + CORS + rate limiting layered, PII redaction in logs, server-authoritative pricing on checkout, no `eval`/SSRF sinks, secrets env-only. The gaps concentrate in three places worth fixing before any derivative goes to production:

1. **Turnstile verification is incomplete** — only `result.success` is checked; `hostname` and `action` are ignored, and the verify cache lets the same token be replayed for 60 seconds.
2. **No Worldline webhook** — payment state is learned only through client-initiated polling. The SDK ships webhook signature validation that the app doesn't use.
3. **`/checkout` has no idempotency key** — retries within the same millisecond of the same session can create duplicate hosted checkouts.

Top-5 must-fix items listed at the end of this document.

---

## 2. Secret scan

| Tool | Result |
|---|---|
| Pattern scan (regex, manual) | Clean — see bullet list below |
| Gitleaks 8.28.0 (`gitleaks detect`) | `no leaks found` — 1 commit, 399 KB in 141 ms |

**Evidence of clean baseline:**

- `.env` is **not** committed. Only [.env.example](.env.example) ships, with every value blank.
- `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`.
- `.dockerignore` matches.
- Only one commit in git history; no need to purge older commits.
- No known-provider prefixes (`sk-ant-*`, `sk_live_*`, `AKIA…`, `ghp_/gho_/ghu_/ghr_*`) anywhere.
- No bare JWTs (`eyJ…`), no `-----BEGIN … PRIVATE KEY-----` blocks.
- Server-side credentials read only from `process.env` — verified at [server/lib/worldlineSdk.js:16-22](server/lib/worldlineSdk.js:16), [server/services/boutiqueAssistantService.js:47-48](server/services/boutiqueAssistantService.js:47), [server/middleware/turnstile.js:52](server/middleware/turnstile.js:52), [server/db/index.js:5-7](server/db/index.js:5).
- Client bundle only receives public values — `VITE_API_BASE_URL`, `VITE_TURNSTILE_SITE_KEY` (public by design), `VITE_SITE_URL`. Verified at [web/src/lib/api.ts:1](web/src/lib/api.ts:1), [web/src/hooks/useTurnstile.ts:78](web/src/hooks/useTurnstile.ts:78), [web/src/components/boutique/SeoHead.tsx:26](web/src/components/boutique/SeoHead.tsx:26).
- `users.password_hash` at [migrations/001_schema.sql:33](migrations/001_schema.sql:33) is a hashed field; seed migration creates no seeded user.
- Dockerfile never `COPY .env` or bakes secrets into an image layer; runtime secrets come via compose `env_file` ([docker-compose.yml:31-32](docker-compose.yml:31)).

**Flagged even with a clean scan:**

- **[SEC-MED-1]** Demo Postgres credentials hardcoded in [docker-compose.yml:5-7](docker-compose.yml:5) (`boutique/boutique`) and echoed in the default `DATABASE_URL` at line 34. Fine for `docker compose up` demo but easy to copy-paste into production unchanged. Recommendation: require `POSTGRES_PASSWORD` from the host environment (unset by default) and fail the stack if absent.
- **[INFO]** No pre-commit or CI secret-scan hook configured. The repo is clean today; add Gitleaks (or `git secrets`) to `.git/hooks/pre-commit` or a CI step to keep it clean.

---

## 3. Security findings

### 3.1 High

#### [SEC-H-1] Turnstile `siteverify` response only checks `success`

- **Where:** [server/middleware/turnstile.js:95](server/middleware/turnstile.js:95)
- **What:** The middleware accepts any response where `result.success === true`. It does **not** validate `hostname`, `action`, `cdata`, or token age (`challenge_ts`).
- **Impact:** A token minted for *any* Turnstile-protected site using the same secret, or for a different `action` on this site, will verify. The widget sends `action: 'boutique'` ([web/src/hooks/useTurnstile.ts:88](web/src/hooks/useTurnstile.ts:88)) but the server never enforces it. Bot-protection value is reduced — an attacker who can mint a token elsewhere can call `/chat` and `/checkout` freely.
- **Remediation:** After `result.success`, also check:
  - `result.hostname` against an allowlist built from `FRONTEND_URL`.
  - `result.action === 'boutique'` (or whatever action the client is expected to use per route — consider `chat` / `checkout`).
  - `Date.now() - Date.parse(result.challenge_ts) < 5 * 60_000` (5-minute freshness).
- **References:** [Cloudflare Turnstile server-side validation docs](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

#### [SEC-H-2] Turnstile feature flag is public-readable → bypass probing

- **Where:** [server/app.js:45-54](server/app.js:45) (`ALLOWED_PUBLIC_FLAGS` includes `boutique_turnstile_required`), [server/routes/boutique.js:171-175](server/routes/boutique.js:171) (`optionalTurnstile` reads the flag).
- **What:** If an operator toggles `boutique_turnstile_required` off for any reason (debugging, outage), `/chat` and `/checkout` become fully unauthenticated. Worse, the current state of the flag is reachable at `GET /api/system/public-feature-flags/boutique_turnstile_required` without any auth.
- **Impact:** Attackers can poll the public endpoint to detect when bot protection drops, and mass-attack exactly in that window. Scripted abuse becomes drive-by.
- **Remediation:** Remove `boutique_turnstile_required` from `ALLOWED_PUBLIC_FLAGS`. The frontend already knows whether a Turnstile key is configured (via `VITE_TURNSTILE_SITE_KEY`) — it doesn't need the server-side flag to decide whether to render the widget.

#### [SEC-H-3] DB connection uses `rejectUnauthorized: false` in production

- **Where:** [server/db/index.js:10](server/db/index.js:10)
- **What:** `ssl: isProduction ? { rejectUnauthorized: false } : false`. In production mode, TLS is attempted but any certificate (self-signed, wrong host, expired) is accepted.
- **Impact:** Man-in-the-middle attacks on the DB link are not prevented. On hosted Postgres (RDS, Neon, Supabase), a transparent TLS-terminating proxy can intercept every query and mutation.
- **Remediation:** Default to `rejectUnauthorized: true` and require the operator to provide `PGSSLROOTCERT` (or `sslmode=verify-full` in the `DATABASE_URL`). Fail loudly if TLS is attempted without a trust anchor in production.

#### [SEC-H-4] CORS `origin: true` when `FRONTEND_URL` is unset

- **Where:** [server/app.js:35-38](server/app.js:35)
- **What:** `origin: process.env.FRONTEND_URL || true` combined with `credentials: true`. If `FRONTEND_URL` is forgotten (easy: it is *optional* per `.env.example`), `cors` reflects the request's `Origin` back and allows cookies cross-origin.
- **Impact:** Any attacker site in the user's browser can call the API with the victim's `boutique_sid` cookie. Combined with the optional-JWT flow, checkout can be initiated from third-party pages. Effectively CSRF-on-demand.
- **Remediation:** Fail startup if `FRONTEND_URL` is unset in production; in dev, bind to `http://localhost:5173`. Never fall back to `origin: true` when `credentials: true`.

#### [SEC-H-5] `/checkout` has no idempotency key → double-charge risk

- **Where:** [server/routes/boutique.js:339-525](server/routes/boutique.js:339), merchant-reference generation at [line 450](server/routes/boutique.js:450).
- **What:** `merchantReference = boutique_{sessionId.slice(0,8)}_{Date.now()}`. A retry within the same millisecond produces the same reference; a retry one millisecond later produces a brand-new hosted checkout. No request-level idempotency key is accepted or stored. Worldline may deduplicate by merchant reference on its side, but that is not guaranteed across sub-millisecond retries, different sessions, or after Worldline-side retention expires.
- **Impact:** Network blips, accidental double-clicks, reverse-proxy retries, and (especially) agent retries can create duplicate hosted checkouts. In agentic-commerce contexts — the stated purpose of this reference implementation — retries are the norm, not the exception.
- **Remediation:** Accept an `Idempotency-Key` header. Store it in a new `checkout_intents` table (or in Redis with a 24 h TTL), keyed to `{session_id, idempotency_key}`. On a duplicate, return the original hosted-checkout response instead of creating a new one. Additionally, make `merchantReference` include a `crypto.randomUUID()` so it is unambiguously globally unique.

#### [SEC-H-6] No Worldline webhook → weak payment-state integrity

- **Where:** only polling endpoint [server/routes/boutique.js:530-575](server/routes/boutique.js:530); no webhook route anywhere in the codebase (grep for `webhook|signature|hmac|X-GCS` returned zero matches in `server/`).
- **What:** Final payment state is only learned when the client polls `GET /payment-status/:hostedCheckoutId`. The browser controls when / whether that happens. The Worldline SDK *ships* the webhook receiver machinery — [node_modules/onlinepayments-sdk-nodejs/lib/esm/src/webhooks/validation.js](node_modules/onlinepayments-sdk-nodejs/lib/esm/src/webhooks/validation.js) exports `newSignatureValidator(store)` which enforces `X-GCS-Signature` / `X-GCS-KeyId` with HMAC-SHA256. The app does not use it.
- **Impact:** A user who closes the tab mid-capture leaves `payment_logs` in a never-updated state. A malicious user can decline to poll and claim the payment never succeeded. Any downstream fulfilment that relies on the poll is racy and under the attacker's control.
- **Remediation:** Add `POST /api/worldline/webhook`. Mount it with `express.raw({ type: 'application/json' })` so the body is available in bytes. Verify signature with `newSignatureValidator({ getSecretKey: (keyId) => … })` — keyed lookup of the Worldline-issued webhook secret. On valid signature, update `payment_logs` by `hosted_checkout_id` exactly like the poll path. Keep the poll path as a fallback.

---

### 3.2 Medium

#### [SEC-M-1] Turnstile verified-token cache enables 60-second replay

- **Where:** [server/middleware/turnstile.js:17, 79-100](server/middleware/turnstile.js:17)
- **What:** After a successful verification, the SHA-256 hash of the token is stored in Redis for 60 seconds. A second request inside that window skips the Cloudflare call and is accepted.
- **Impact:** Given SEC-H-1 (no `hostname`/`action` check) this becomes real: a legitimate token harvested from the frontend can be reused 60× per minute across `/chat` and `/checkout` by any third party.
- **Remediation:** Either remove the cache entirely (the rate limiter already caps `/checkout` to 10 rpm) or drop the TTL to ~5 seconds and additionally bind the cache key to `req.ip + action`, so a token can only be replayed by the same caller and scope.

#### [SEC-M-2] `payment_logs.request_body` / `response_body` store raw JSON; no retention

- **Where:** [server/db/paymentLogs.js:37-42](server/db/paymentLogs.js:37); columns at [migrations/001_schema.sql:145-149](migrations/001_schema.sql:145); writes at [server/routes/boutique.js:480, 508](server/routes/boutique.js:480).
- **What:** Both request and response bodies are persisted as `TEXT`. The route redacts `email` in `request_body` ([boutique.js:403](server/routes/boutique.js:403)) but the Worldline response (which may contain authorisation codes, merchant metadata, masked PAN, 3DS details) is stored verbatim. No TTL or purge job.
- **Impact:** The table becomes a long-lived sensitive-data store. Any future SQL-injection, backup leak, or admin-console pivot exposes months/years of payment history. PCI DSS scope-expansion risk if the data is read back into the application.
- **Remediation:** Strip `response_body` to the fields the app actually uses (status, id, masked PAN, brand, auth code). Add a 90-day retention policy (`DELETE FROM payment_logs WHERE created_at < now() - interval '90 days'` on a cron). Drop raw `request_body` retention entirely — the structured columns already capture everything you need.

#### [SEC-M-3] Rate limiters fail open on Redis outage

- **Where:** [server/lib/rateLimitStore.js:24-31](server/lib/rateLimitStore.js:24), [server/services/boutiqueAssistantService.js:141-143](server/services/boutiqueAssistantService.js:141)
- **What:** Both the express-rate-limit store and the Claude-session turn-quota use fail-open sentinels: `INCR` → 1, so every request looks like "first in window" when Redis is down.
- **Impact:** During a Redis incident, Claude costs and Worldline call volumes become unbounded. A targeted DDoS aimed at Redis (even just saturating its connection count) becomes a cost-amplification attack.
- **Remediation:** Fail closed on write endpoints (`/chat`, `/checkout`) during Redis outage — return 503. Keep fail-open on read-only browse endpoints.

#### [SEC-M-4] Helmet CSP uses `'unsafe-inline'` for scripts and styles

- **Where:** [server/app.js:23-24](server/app.js:23)
- **What:** CSP allows `'unsafe-inline'` in both `script-src` and `style-src`. The stated reason (JSON-LD block + Turnstile) can be met with nonces or SHA-256 hashes.
- **Impact:** Any injected script or style is executed. CSP's primary value against reflected / DOM XSS is lost.
- **Remediation:** Generate a per-request nonce, stamp it onto the JSON-LD `<script>` tag in [web/src/components/boutique/SeoHead.tsx:58-65](web/src/components/boutique/SeoHead.tsx:58), and emit `script-src 'self' 'nonce-<…>' https://challenges.cloudflare.com`. For styles, use Tailwind's compiled classes and drop `'unsafe-inline'` from `style-src`.

#### [SEC-M-5] `dangerouslySetInnerHTML` renders JSON-LD

- **Where:** [web/src/components/boutique/SeoHead.tsx:63](web/src/components/boutique/SeoHead.tsx:63)
- **What:** `<script dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />`. Today the `block` comes from server-controlled product data and is always an object — `JSON.stringify` escapes `<`, `>`, `/` incompletely for HTML contexts (the characters `<` / `>` inside string values get serialised as-is, so `</script>` in a description field would break out of the tag).
- **Impact:** Low practical risk today because product descriptions come from admin-seeded catalog, not user input. But if the catalog ever starts accepting user-authored descriptions or reviews, this becomes XSS in a CSP-bypass context.
- **Remediation:** Either validate `block` against a strict Zod schema before stringifying, or use the known-safe `JSON.stringify(x).replace(/</g, '\\u003c')` pattern to neutralise `</script>` in any value. Long-term: render `<script>` elements using React's built-in `children` and let React escape.

#### [SEC-M-6] Turnstile JS loaded without Subresource Integrity

- **Where:** [web/src/hooks/useTurnstile.ts:61-65](web/src/hooks/useTurnstile.ts:61)
- **What:** `script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=…'`. No `integrity=` or `crossorigin=`.
- **Impact:** Cloudflare is high-trust today, but a future CDN compromise or DNS hijack would execute arbitrary JS in the storefront's origin — with cookies and full access to the SPA.
- **Remediation:** Turnstile does not publish a stable SRI hash (the script mutates), so SRI is not directly applicable. Instead, tighten CSP `script-src` to *only* `challenges.cloudflare.com` and remove `'unsafe-inline'` (see SEC-M-4). That is the best defence in depth available.

#### [SEC-M-7] `ai_conversation_logs` has no retention policy

- **Where:** [migrations/001_schema.sql:185-197](migrations/001_schema.sql:185), writes at [server/services/agentBridge.js:30-40](server/services/agentBridge.js:30).
- **What:** Every user message (up to 4000 chars, truncated by agentBridge) and every assistant reply is persisted forever. No TTL, no purge, no per-user delete endpoint.
- **Impact:** GDPR right-to-erasure cannot be honoured for chat. Over time the table becomes the biggest table in the DB and a rich target for exfiltration.
- **Remediation:** Add `ai_conversation_logs_created_idx` (already present for `(session_id, created_at)`) and a scheduled purge of rows older than 30 days. Add a `DELETE … WHERE user_id = $1` helper.

#### [SEC-M-8] JWT `authenticateToken` response leaks configuration

- **Where:** [server/middleware/auth.js:13-15](server/middleware/auth.js:13)
- **What:** Returns `401 { error: 'Auth disabled — JWT_SECRET not configured' }` when `JWT_SECRET` is missing.
- **Impact:** Information disclosure: an attacker learns that JWT auth is disabled and can stop trying to forge tokens.
- **Remediation:** Return the same generic `401 { error: 'Invalid token' }` for both "missing secret" and "bad signature".

#### [SEC-M-9] Cart-total headroom allows single order to hit the €30 k cap

- **Where:** quantity clamp at [server/routes/boutique.js:141](server/routes/boutique.js:141) (99/line) × max 50 lines at [line 352](server/routes/boutique.js:352) × hard cap at [line 42](server/routes/boutique.js:42) (`MAX_CHECKOUT_CENTS`).
- **What:** 50 lines × 99 units is well over the €30 k cap for almost any GoCard product, so the cap does the heavy lifting. But a single checkout can still approach €30 000 with cheap items — material for payment-team chargeback risk in a real deployment.
- **Impact:** For a reference implementation, not critical. For any derivative doing real money, the "max order value" should match the merchant's risk policy, not the API cap.
- **Remediation:** Document that `MAX_CHECKOUT_CENTS` is the *platform ceiling*, not the *business ceiling*. Expose a configurable per-merchant cap read from `companies`.

#### [SEC-M-10] Payment-status polling is unauthenticated

- **Where:** [server/routes/boutique.js:530-575](server/routes/boutique.js:530)
- **What:** Anyone who knows a `hostedCheckoutId` can poll payment status and receive the full payload including masked PAN, auth code, amount, currency. The endpoint has only a length check + rate limiter.
- **Impact:** The `hostedCheckoutId` is returned to the browser at checkout and is not otherwise secret, but logs, analytics pixels, shared Slack links, etc. all become leak vectors for payment outcomes. Low severity because the PAN is masked and there is no CVV, but it is a clear confidentiality failure against an adversary who harvests hosted-checkout IDs.
- **Remediation:** Bind the ID to the `boutique_sid` cookie at creation time (new row in Redis or a `checkout_intents` table keyed by session). Reject polls from a different session. Or require the frontend to supply `RETURNMAC` — Worldline provides it exactly for this purpose.

#### [SEC-M-11] `worldline response_body` / `error.message` logging may surface tokenised card data

- **Where:** [server/routes/boutique.js:513-515](server/routes/boutique.js:513)
- **What:** On error, the route logs `error.message` and persists `logData.errorMessage = error.message`. Worldline SDK errors sometimes embed the (masked) response payload into the error message. Pino's path redaction does not reach into free-text strings.
- **Impact:** Depending on SDK version, partial card data can land in both server logs and the `payment_logs` table. For a demo with test-card-only data, harmless; for real deployments, a PCI-scope concern.
- **Remediation:** Wrap SDK errors in a classifier that extracts `status`, `errorId`, `category`, and a sanitised summary — never log `error.message` verbatim.

---

### 3.3 Low / Info

- **[SEC-L-1]** Jailbreak regex guard at [server/services/boutiqueAssistantService.js:35-41](server/services/boutiqueAssistantService.js:35) is trivially bypassed (`"ign0re previous instructions"`, unicode homoglyphs, translation). Accepted risk because the concierge has **no tool calls** and recommendations are filtered against real catalog IDs at [line 205](server/services/boutiqueAssistantService.js:205). Blast radius limited to brand-voice embarrassment.
- **[SEC-L-2]** `merchantReference` leaks the first 8 chars of the session cookie to Worldline merchant dashboards at [server/routes/boutique.js:450](server/routes/boutique.js:450). Minor info leak.
- **[SEC-L-3]** No CSRF token on `POST /checkout` or `POST /chat`. Mitigated by `sameSite=lax` cookie at [server/routes/boutique.js:183](server/routes/boutique.js:183), but the mitigation falls away if SEC-H-4 (CORS reflection) is exploited. Add a double-submit-cookie token for defence in depth.
- **[SEC-L-4]** `boutique_sid` cookie is `secure` only when `NODE_ENV=production` ([server/routes/boutique.js:184](server/routes/boutique.js:184)). Correct, but worth a note for staging / preview deployments that do have HTTPS but not `NODE_ENV=production`.
- **[SEC-L-5]** `100 kb` body limit at [server/app.js:40](server/app.js:40) is good. No upload endpoints. Confirmed no `eval`, `Function`, `child_process`, or SSRF sinks anywhere in `server/`.
- **[SEC-L-6]** `HSTS` is not explicitly configured beyond Helmet defaults. Helmet's default `max-age=15552000 (180 days)` is applied; an explicit call to `helmet.hsts({ maxAge: 63072000, includeSubDomains: true, preload: true })` would be worth adding for production deployments that plan to submit to the HSTS preload list.

---

## 4. Performance findings

### 4.1 High

#### [PERF-H-1] Product detail endpoint fetches the entire catalog

- **Where:** [server/routes/boutique.js:256-257](server/routes/boutique.js:256)
- **What:** `const all = await fetchBoutiqueProducts(); const product = all.find((p) => p.id === req.params.id);` — a 6-table JOIN over the whole `products` brand scope to answer one `WHERE id = $1`.
- **Impact:** O(N) catalog reads per detail hit. Cheap at 12 items; a 10 k-item catalog makes every detail view an order of magnitude more expensive than it needs to be.
- **Remediation:** Replace with a dedicated `fetchBoutiqueProduct(id)` that runs `WHERE p.id = $1 AND p.brand_id = $2 AND p.status = 'active'` — reuse the same JOIN shape so the normaliser is identical.

#### [PERF-H-2] Unoptimised product images (~5.1 MB total)

- **Where:** `web/public/boutique/*.jpg` — measured:
  - `van-gogh-hero.jpg`: 768 KB
  - `rijksmuseum-overnight.jpg`: 736 KB
  - `amsterdam-canal.jpg`: 456 KB
  - `formula-e-monaco.jpg`: 392 KB
  - `monaco-yacht.jpg`: 380 KB
  - (nine others): 180–332 KB each
  - **Total: ~5.1 MB**, all JPEG, no `srcset`, no WebP/AVIF alternatives, no explicit width/height on `<img>` tags.
- **Impact:** First paint pulls the hero (768 KB). Scrolling the grid fetches the rest serially over the same HTTP/1.1 or multiplexed H/2 pool. On 3G-class connections the full grid takes 40+ seconds. No Core-Web-Vitals "LCP" optimisation.
- **Remediation:**
  - Pre-build WebP + AVIF variants at 800w / 1600w. Use `<picture>` with `<source type="image/avif">` / `<source type="image/webp">` fallbacks.
  - Add explicit `width` / `height` on `<img>` to prevent CLS.
  - Use `fetchpriority="high"` on the hero only; `loading="lazy"` already exists on the cards at [web/src/components/boutique/BoutiqueProductCard.tsx:24](web/src/components/boutique/BoutiqueProductCard.tsx:24).
  - Target ≤ 150 KB per card image (AVIF at Q50 is usually enough).

### 4.2 Medium

#### [PERF-M-1] Claude prompt rebuilt every turn without cache-control

- **Where:** [server/services/boutiqueAssistantService.js:78-96, 186-193](server/services/boutiqueAssistantService.js:78)
- **What:** `system` prompt includes the full product catalog (~12 items × ~200 chars ≈ 2 400 tokens) on every `messages.create`. No `cache_control` markers.
- **Impact:** Each cold turn re-tokenises the catalog. At `claude-3-5-haiku-latest` prices the ticket is small per turn, but scales linearly with volume. Latency also suffers.
- **Remediation:** Add `cache_control: { type: 'ephemeral' }` to the `system` block (last content block technique). Measure cache-hit rate in production; expect >70% once session traffic stabilises.

#### [PERF-M-2] `/capabilities` runs 5 feature-flag reads per call, no HTTP cache

- **Where:** [server/routes/boutique.js:201-207](server/routes/boutique.js:201)
- **What:** Five `flag()` calls per request, no `Cache-Control` on the response. `FeatureFlagsDB.getFlag` already caches per-key for 120 s ([server/db/featureFlags.js:5](server/db/featureFlags.js:5)) so the DB cost is bounded, but the endpoint still pays per-request CPU and its response is not cacheable by the browser or any CDN.
- **Impact:** Called on every homepage mount and every chat/cart panel open. Small per call, big in aggregate once scaled.
- **Remediation:** `res.set('Cache-Control', 'public, max-age=60')` on success. Consider batch-reading: a single `WHERE name = ANY($1)` query instead of five sequential ones.

#### [PERF-M-3] No SPA code-splitting

- **Where:** [web/vite.config.ts](web/vite.config.ts), Vite default
- **What:** The boutique grid, product detail page, and payment return page all ship in the same bundle. `chunkSizeWarningLimit: 1200` suggests it already approaches 1.2 MB compressed.
- **Impact:** First Load is larger than it needs to be on the homepage; the `return` page code is only needed after payment but is parsed and compiled up-front.
- **Remediation:** Use `React.lazy(() => import('./pages/BoutiqueReturn'))` for the return page (only reached on redirect-back) and similarly for `BoutiqueProductPage`. Combine with a router-level `Suspense` fallback.

#### [PERF-M-4] `getBoutiqueCatalog` in-process memo has no eviction or clustering awareness

- **Where:** [server/services/boutiqueAssistantService.js:53, 55-68](server/services/boutiqueAssistantService.js:53)
- **What:** In-memory single-entry cache keyed on "all products, this brand". Size grows only with catalog growth — safe — but on a clustered deploy each Node worker keeps its own copy, which creates N independent 60-second windows and N thundering herds on restart.
- **Impact:** Minor at demo scale; noticeable under load if the process count grows.
- **Remediation:** Move the cache to Redis with a short TTL, or use a single-flight wrapper so only one fetch per window can be in flight. The existing `cacheService` (used by `FeatureFlagsDB`) already has the plumbing.

#### [PERF-M-5] Rate-limit keygen doubles key cardinality with UA hash

- **Where:** [server/lib/rateLimitStore.js:80-92](server/lib/rateLimitStore.js:80), [server/middleware/boutiqueRateLimit.js:9](server/middleware/boutiqueRateLimit.js:9)
- **What:** The key is `${ip}:${sha256(ip:ua)[:16]}`, so each IP/UA pair has its own bucket. This is good for spreading IPv4 mobile NAT, but bad for Redis memory — the hot set is proportional to unique-device count rather than unique-IP count.
- **Impact:** Typical Redis deployments cope fine; flag for high-traffic derivatives.
- **Remediation:** Keep the current behaviour for `/chat` and `/checkout` (where UA variance reduces false positives), but drop the UA hash for `/products` / `/categories` (where IP-only is plenty).

### 4.3 Low / Info

- **[PERF-L-1]** No `React.memo` on `BoutiqueProductCard`. At 12 items, irrelevant. Revisit if the catalog grows.
- **[PERF-L-2]** TanStack Query `staleTime: 2 min` is a reasonable default.
- **[PERF-L-3]** Sourcemaps disabled in prod ([web/vite.config.ts:23](web/vite.config.ts:23)) — good for bundle size *and* for not shipping readable source.

---

## 5. Dependency audit

`npm audit --workspaces --json` output:

| Package | Severity | Direct? | Fix available | Advisory |
|---|---|---|---|---|
| `uuid` (< 14.0.0) | moderate | transitive via `onlinepayments-sdk-nodejs` | no | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) — "Missing buffer bounds check in v3/v5/v6 when `buf` is provided" (CWE-787, CWE-1285) |
| `onlinepayments-sdk-nodejs` | moderate | direct | no | rolls up the `uuid` advisory |

**Analysis:** Neither of these currently expose the application. The app imports `crypto.randomUUID()` ([server/routes/boutique.js:180, 437](server/routes/boutique.js:180)) and `crypto.randomBytes()`, not the `uuid` package directly. The vulnerable code path (v3/v5/v6 with a `buf` argument) is not reached by the SDK's typical usage (it uses v4 random).

**Recommendation:** Track the SDK's next release. If the finding lingers >90 days, either (a) force-resolve `uuid@^14` via `overrides` in `package.json` and verify end-to-end, or (b) document acceptance in a `SECURITY.md` exception log.

**Other dep hygiene:**

- `@anthropic-ai/sdk@^0.24.3` is pinned to an older minor (late Feb 2024). Newer versions have native prompt-caching and better streaming. Not a CVE — a feature-gap. Worth upgrading as part of PERF-M-1 remediation.
- `express@^4.18.2` — fine. Express 5 is GA but not urgent.
- `pg@^8.11.3`, `ioredis@^5.4.1`, `jsonwebtoken@^9.0.3` — all clean in this `npm audit` output.

**Dev dependency count:** 389 total (prod 194 / dev 195 / optional 65 / peer 0).

---

## 6. Top-5 must-fix before any derivative ships

| # | Finding | Effort | Why first |
|---|---|---|---|
| 1 | **SEC-H-1** — Validate Turnstile `hostname` / `action` / freshness | S (~30 min) | Without this, bot protection is theatre |
| 2 | **SEC-H-6** — Add Worldline webhook handler with `newSignatureValidator` | M (~half-day) | Only authoritative way to learn payment state |
| 3 | **SEC-H-5** — Add `Idempotency-Key` support on `/checkout` | M | Duplicate charges are the worst kind of payment bug |
| 4 | **SEC-H-4** — Remove `origin: true` fallback; require `FRONTEND_URL` in prod | S | Trivially exploitable in misconfigured deploys |
| 5 | **PERF-H-2** — Ship WebP/AVIF + `srcset` for the 14 boutique images | M | Single biggest UX win; 80%+ weight drop |

Honourable mentions: **SEC-H-2** (make `boutique_turnstile_required` non-public) and **SEC-H-3** (fix DB TLS verification).

---

## 7. Methodology appendix

- **Static review:** All files under `server/` and `web/src/` read end-to-end; `migrations/`, Dockerfile, docker-compose.yml, `.env.example` read in full.
- **Data-flow tracing:** Browser → SPA → `/api/boutique/*` → {Postgres, Redis, Worldline SDK, Anthropic SDK, Cloudflare `siteverify`}. Each hop checked for auth, input validation, secret handling, error propagation.
- **Secret scan:** manual regex pass plus Gitleaks 8.28.0 (`gitleaks detect --no-banner --redact --verbose`). Scanned `.git` history in addition to the worktree.
- **Dependency audit:** `npm audit --workspaces --json` on the root workspace.
- **SDK deep-read:** Worldline SDK `webhooks/validation.js` inspected to confirm webhook signature helper is shipped and unused.

All findings cite file-and-line pointers verified to exist in the commit under audit.
