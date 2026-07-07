# FinBest MVP Deployment Notes

## Local

```bash
npm install
npx prisma generate
npx next dev --webpack -p 3002
```

Local demo uses SQLite:

```env
DATABASE_URL="file:./db/custom.db"
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

The current MVP is still configured for SQLite in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

For production Neon, change the provider to PostgreSQL before deployment:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Then set Vercel environment variable:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DB?sslmode=require"
```

After switching provider, run a migration against Neon:

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
