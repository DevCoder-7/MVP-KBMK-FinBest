# FinBest MVP Deployment Notes

## Local

```bash
npm install
npx prisma generate
npx next dev --webpack -p 3002
```

Local and production now use Neon PostgreSQL:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require&connect_timeout=15"
DIRECT_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/neondb?sslmode=require&connect_timeout=15"
SESSION_SECRET="replace-with-a-long-random-secret"
```

## Vercel

Recommended Vercel root directory:

```text
.
```

If this app is pushed as a subfolder inside a larger monorepo, set the Vercel root directory to that app folder, for example `Semifinal/MVP/Web/App`.

Build command:

```bash
npm run build
```

## Neon Database

The MVP is configured for Neon/PostgreSQL in `prisma/schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Use two Neon connection strings:

- `DATABASE_URL`: pooled connection string, hostname contains `-pooler`.
- `DIRECT_URL`: direct connection string, hostname does not contain `-pooler`.

Set these Vercel environment variables for Production and Preview:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require&connect_timeout=15"
DIRECT_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/neondb?sslmode=require&connect_timeout=15"
SESSION_SECRET="replace-with-a-long-random-secret"
MARKET_DATA_PROVIDER="yahoo"
MARKET_CACHE_TTL_MS="30000"
MARKET_FETCH_TIMEOUT_MS="4000"
```

Push the schema to Neon before or after deploying:

```bash
npx prisma generate
npx prisma db push
```

Seed data is optional, but recommended for demo content:

```bash
npx tsx prisma/seed.ts
npx tsx prisma/seed-account.ts
npx tsx prisma/seed-knowledge.ts
```

For a migration-based production workflow:

```bash
npx prisma migrate dev --name init-postgres
npx prisma generate
```

## Market Data

Default MVP market data uses the server-side adapter in `src/lib/market-data.ts`:

- Yahoo Finance chart endpoint for IDX symbols such as `BBCA.JK`.
- 30 second cache by default.
- API routes fall back to seeded DB values if the provider is unavailable.

Optional provider:

```env
MARKET_DATA_PROVIDER="twelvedata"
TWELVE_DATA_API_KEY="your_key"
```

Twelve Data Basic is free but limited, so keep Yahoo as the IDX demo fallback unless the team decides to use an official provider/key.
