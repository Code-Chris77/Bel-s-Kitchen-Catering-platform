# Bel's Kitchen Catering Service

Online ordering and catering management for Bel's Kitchen, built with
[vinext](https://github.com/cloudflare/vinext) (Next.js App Router on Vite),
React 19, Tailwind CSS 4, shadcn/ui, and Cloudflare Workers + D1 with Drizzle ORM.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Customer menu, cart and checkout (delivery or restaurant pickup) |
| `/track` | Order progress, opened with the order number and 6-digit tracking password |
| `/kitchen` | Password-protected kitchen queue for chefs |
| `/admin` | Admin login, revenue dashboard, CSV export and kitchen-password management |
| `/privacy` | What customer data is kept and for how long |

## Requirements

- Node.js 22.13 or newer
- npm
- A Cloudflare account for deployment (not needed locally)

## Local development

```bash
npm ci
cp .dev.vars.example .dev.vars   # then replace every value
npm run db:migrate:local         # create tables in the local D1 database
npm run dev
```

The local D1 database lives in `.wrangler/state` and is separate from production.

## Environment variables

Set in `.dev.vars` locally and with `npx wrangler secret put NAME` in production.

| Name | Purpose |
| --- | --- |
| `KITCHEN_PASSWORD` | Initial kitchen password. Ignored once an admin sets one in `/admin`. |
| `KITCHEN_SESSION_SECRET` | Signs kitchen sessions. Required. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin login. |
| `ADMIN_SESSION_SECRET` | Signs admin sessions. Required. |
| `TRACKING_SECRET` | Optional. Keys tracking-code hashes (defaults to `KITCHEN_SESSION_SECRET`). Changing it invalidates tracking passwords of existing orders. |

Use long random values for every secret.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | Build, then run the tests in `tests/` |
| `npm run db:generate` | Generate a migration after editing `db/schema.ts` |
| `npm run db:migrate:local` / `db:migrate:remote` | Apply migrations to local / production D1 |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` after editing `wrangler.jsonc` |
| `npm run deploy` | Build and deploy with Wrangler |

## Deploying to Cloudflare

1. `npx wrangler d1 create bels-kitchen`, then put the printed `database_id` in `wrangler.jsonc`.
2. `npm run db:migrate:remote`
3. Add each secret above with `npx wrangler secret put`.
4. `npm run deploy`

CI (`.github/workflows/ci.yml`) runs typecheck, lint and tests on every push and pull request; CodeQL and Dependabot are enabled.
`.github/workflows/deploy.yml` can deploy manually once `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets exist.

A daily Cron Trigger (`wrangler.jsonc`) anonymises customer names, phone numbers and delivery locations on orders older than 90 days (`lib/retention.ts`).

## Project layout

| Folder | Contents |
| --- | --- |
| `app/` | Pages and API routes |
| `components/` | Brand component and the shadcn/ui primitives in use |
| `hooks/` | Shared React hooks (visibility-aware polling) |
| `branding/` | Full-resolution original logo (the site serves a resized copy from `public/`) |
| `db/` | D1 access and Drizzle schema |
| `drizzle/` | SQL migrations |
| `lib/` | Menu/status rules (`domain.ts`), auth, tracking codes, rate limiting, crypto helpers |
| `worker/` | Worker entry: image optimisation, security headers, cross-site write protection |
| `tests/` | Node test runner suites |

Menu items, prices, delivery fees, payment methods and the order-status flow are
defined once in `lib/domain.ts`.

## Security notes

- Sessions are signed, `HttpOnly; Secure; SameSite=Strict` cookies.
- Login, order creation and order tracking are rate limited per IP (D1-backed, `lib/rate-limit.ts`).
- Kitchen staff can cancel an order until it leaves the kitchen; every status change is recorded in `order_events`.
- Tracking codes are stored as keyed HMACs; kitchen passwords as salted PBKDF2.
- The worker sets CSP, HSTS and related headers, marks `/admin`, `/kitchen` and `/track` as `noindex`,
  and rejects cross-origin writes to `/api/*`.

## Current limitations

- **Payments are demo only.** Orders are recorded as `demo_paid` and no money is taken. Integrate
  Paystack, Flutterwave or Hubtel, and only treat orders as paid after a verified webhook.
- **SMS is demo only.** The message text is shown on screen but never sent.
- Branding assets live in `public/`; do not alter the supplied logo.
