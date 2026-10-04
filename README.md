# Steady — Financial Habits & Behavioural Resilience

A behavioural-finance assistant that slows down impulsive spending decisions.

It is **not** a financial advisor. There is no market data, no bank connection,
no investment advice and no prediction of any kind. The entire "intelligence" is
a set of deterministic, readable rules — the same inputs always produce the same
advice, and the app always tells you exactly which rule fired and why.

---

## Quick start

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run db:migrate        # creates prisma/dev.db and applies migrations
npm run db:seed           # optional: demo account + 12 sample decisions
npm run dev
```

Open <http://localhost:3000> and sign in with the seeded demo account:

```
demo@steady.app / demo1234
```

…or click **Create an account** to start from empty.

> **npm 11 note.** npm blocks dependency install scripts by default, which stops
> Prisma's engine download and the `better-sqlite3` native build. If `npm install`
> warns about pending scripts, approve them once:
> ```bash
> npm approve-scripts prisma @prisma/engines better-sqlite3 esbuild
> ```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server on port 3000 |
| `npm run build` / `npm start` | Production build and serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Create/apply a migration (dev) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Reset and reseed the demo account |
| `npm run db:reset` | Drop, re-migrate and reseed |
| `npm run db:studio` | Prisma Studio |
| `npm run verify` | End-to-end flow tests against a running server |

`npm run verify` and `npm run db:seed` need the dev server running
(`npm run dev` in another terminal) for `verify`.

---

## The three features

### 1. Cooling-off circuit breaker

Logging a decision immediately starts a timer (1 hour / 24 hours / 3 days /
7 days). Until it reaches zero you **cannot** approve the decision.

The lock is enforced on the server in `src/lib/decisions.ts`
(`assertCoolingOffElapsed`), which returns **HTTP 423 Locked** for any early
attempt. The disabled buttons in the UI are only a convenience — calling the
API directly still gets rejected, and no partial reflection row is written.

Once the timer ends, the reconsideration questionnaire unlocks:

- Do I still need this?
- Was this planned, or impulsive?
- Can I comfortably afford it?
- Will this affect an important financial goal?
- Would I make the same decision tomorrow?

You then choose **Go ahead**, **I changed my mind**, or **Abandon it**.

### 2. Decision journal

Every decision is stored with its date, amount, category, original reason,
emotional state, the outcome after cooling-off and your reflection. Search
across title/reason/notes/reflections, filter by status and category, sort by
date or amount. Resolved entries can be read but not rewritten — the journal is
a record, not a draft.

### 3. Rule engine

`src/lib/rules.ts` — pure functions, no model, no randomness, no I/O.

| Rule | Fires when | Effect |
| --- | --- | --- |
| `HIGH_AMOUNT` | amount > your threshold | recommend a cooling-off period |
| `EMOTIONAL_STATE` | angry, sad, stressed, anxious, impulsive or excited | wait until calm |
| `URGENT_NON_ESSENTIAL` | urgency `high` but not essential | high impulse-risk flag |
| `REPEAT_CATEGORY` | N+ same-category decisions inside the habit window | spending-habit warning |
| `RECONSIDERED` | you changed your mind after waiting | counted as behavioural resilience |

Each rule carries a fixed severity weight (info 22, warn 44, high 66, capped at
100) which produces the impulse-risk band shown on the dashboard. Every rule can
be toggled off individually in **Rules & settings**, and thresholds are
per-user.

**Behavioural resilience %** is simply the share of your resolved decisions that
you reconsidered after waiting. It measures your own habit strength — nothing
more.

---

## Tech stack

- **Next.js 16** (App Router, React 19, TypeScript, Turbopack)
- **Tailwind CSS v4** with a custom fintech palette + hand-rolled shadcn/ui
  primitives on Radix
- **Prisma 7** (Rust-free query compiler + `@prisma/adapter-better-sqlite3`)
- **Zod v4** for validation, **bcryptjs** for password hashing
- **Recharts** for the three dashboard charts
- **httpOnly cookie sessions** stored in the database

### Authentication

Email + password. Passwords are bcrypt-hashed (12 rounds); sessions are random
32-byte tokens in an httpOnly, SameSite=Lax cookie with a 30-day expiry. Login
and registration return identical errors for unknown-email and wrong-password so
accounts cannot be enumerated. Every query is scoped by `userId`, so one user
cannot read or delete another's decisions.

---

## Project layout

```
prisma/
  schema.prisma          # User, Session, UserSettings, Decision,
                         #   DecisionReflection, Rule
  seed.ts                # demo account + realistic history
src/
  app/
    (auth)/              # login, register
    (app)/               # authenticated shell
      dashboard/         # stats + 3 charts + active timers
      decisions/new/     # creation form with live rule feedback
      decisions/[id]/    # cooling-off timer + questionnaire
      journal/           # search, filter, sort, history
      settings/          # thresholds + rule toggles
    api/                 # auth, decisions, journal, settings
  components/ui/         # shadcn/ui primitives
  lib/
    rules.ts             # the deterministic engine
    decisions.ts         # creation + the cooling-off gate
    validation.ts        # Zod schemas
    queries.ts           # dashboard/journal aggregations
    constants.ts         # every controlled vocabulary
scripts/
  verify.ts              # 59 end-to-end assertions
  check-render.ts       # server-render assertions for the cooling-off page
```

---

## Moving to PostgreSQL

The app was built against SQLite for zero-setup local runs, but the schema is
Postgres-ready:

1. In `prisma/schema.prisma`, change the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"
   }
   ```
2. Point `DATABASE_URL` at your instance:
   ```
   DATABASE_URL="postgresql://user:pass@localhost:5432/financial_habits?schema=public"
   ```
3. Swap the driver in `src/lib/db.ts` (and `prisma/seed.ts`) for the Postgres
   adapter, e.g. `@prisma/adapter-pg` with `pg.Pool`.
4. `npx prisma migrate dev --name init_pg`

Two SQLite-specific notes:

- **No native enums.** SQLite has no enum type, so status/emotion/urgency/
  category columns are `String` and validated by Zod at every API boundary. On
  Postgres you can optionally convert them to native enums — the allowed values
  live in `src/lib/constants.ts`.
- **`contains` search** is case-sensitive on SQLite by default. On Postgres it
  uses `ILIKE`, so journal search becomes case-insensitive for free.

The migration in `prisma/migrations/` is SQLite-specific; regenerate for
Postgres rather than reusing it.

---

## What this app deliberately does not do

- No investment recommendations
- No stock/crypto price predictions
- No bank account or transaction connections
- No live market data
- No claim that it can guarantee any financial outcome

It is a habit tool for slowing down and reflecting. That is the whole product.

---

## Testing

```bash
npm run dev              # terminal 1
npm run verify           # terminal 2
```

`npm run verify` runs 59 assertions covering registration and login, duplicate
and invalid input handling, all five rules firing (and not firing), rule
toggling, the cooling-off lock returning 423, successful completion after the
period elapses, resilience recording, double-completion rejection, delete,
journal search/filter/sort, dashboard stat consistency, cross-user isolation,
auth boundaries, logout, and responsive viewport setup. It cleans up the accounts
it creates.