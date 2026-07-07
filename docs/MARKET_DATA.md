# FinBest Market Data

FinBest MVP memakai server-side market data adapter di `src/lib/market-data.ts`.

## Default MVP

- Provider default: Yahoo Finance chart endpoint melalui server Next.js.
- Tujuan: demo IDX tanpa API key, misalnya `BBCA.JK`, `BBRI.JK`, `TLKM.JK`.
- Cache: 30 detik, dapat diubah dengan `MARKET_CACHE_TTL_MS`.
- Timeout: 4 detik, dapat diubah dengan `MARKET_FETCH_TIMEOUT_MS`.
- Fallback: jika provider gagal, API tetap mengembalikan harga seeded dari SQLite.

## Optional Official Provider

Twelve Data Basic gratis dapat dipakai untuk data realtime US equities, forex, dan crypto, tetapi tetap membutuhkan API key dan punya limit credit.

```env
MARKET_DATA_PROVIDER=twelvedata
TWELVE_DATA_API_KEY=your_key_here
MARKET_CACHE_TTL_MS=30000
MARKET_FETCH_TIMEOUT_MS=4000
```

Catatan: untuk saham Indonesia/IDX, adapter default tetap mencoba Yahoo symbol `.JK` karena lebih cocok untuk demo lokal tanpa key.
