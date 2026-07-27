# SiteBook

Contractor job financial management app — track debits/credits per job, see per-project and overall financial standing, admin oversight of all users read-only.

## Stack

- `/api` — Node.js + Express + Prisma + PostgreSQL, JWT auth (access + refresh tokens with rotation)
- `/web` — React + Vite + Tailwind CSS + Recharts

In production, `/api` serves the built `/web` static files directly (single Railway service, no CORS needed).

## Local development

### 1. Get a Postgres database

This machine has no Docker/local Postgres. Easiest path: a free [Neon](https://neon.tech) project.

1. Sign up at neon.tech, create a project (e.g. `sitebook-dev`).
2. Copy the connection string it gives you (starts with `postgresql://...`).

### 2. Configure environment

```
cp api/.env.example api/.env
```

Fill in `api/.env`:

| Var | Description |
|---|---|
| `DATABASE_URL` | Your Neon (or other Postgres) connection string |
| `JWT_SECRET` | Long random string, signs access tokens |
| `JWT_REFRESH_SECRET` | Different long random string, signs refresh tokens |
| `ADMIN_EMAIL` | Email for the admin (oversight) account, bootstrapped on first boot |
| `OWNER_EMAIL` | Email for your personal contractor account, bootstrapped on first boot |
| `PORT` | API port, defaults to 4000 |

### 3. Install and run

```
npm run install:all
npm run dev
```

This starts the API on :4000 and the web app on :5173 (proxying `/api` to the API). On first boot, the API console prints one-time temporary passwords for the admin and owner accounts — save these, they're only shown once.

To also load sample demo data (a separate `demo.contractor@sitebook.local` account with 2 sample projects, unrelated to your real account):

```
npm --prefix api run seed
```

## Deploying to Railway

1. Push this repo to GitHub.
2. In Railway, create a new project from the GitHub repo, and add a PostgreSQL plugin.
3. Set the same env vars as above on the API service (`DATABASE_URL` can reference the Postgres plugin, e.g. `${{Postgres.DATABASE_URL}}`).
4. Railway builds via the root `Dockerfile` (multi-stage: builds `/web`, then `/api`, copies the web build into the final image). On boot, `prisma db push` syncs the schema and bootstrap accounts are created if they don't exist yet — watch the deploy logs for the printed temporary passwords.

## Design notes

- All money amounts are stored as integers in cents (`amountCents`) to avoid floating-point issues; the sign/direction comes from the transaction's `type` (DEBIT/CREDIT), never a negative number.
- Auth uses a short-lived access token (kept in memory client-side) plus a long-lived httpOnly refresh cookie with rotation — each refresh call issues a new refresh token and revokes the old one, so reuse of a stolen/old token is detectable.
- No public signup — new contractor accounts are created by the admin from the Admin panel.
