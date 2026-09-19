# Trackings

Small private panel to track parcels from Chinese suppliers → China warehouse → your door.

## Flow

| Status | Meaning |
|---|---|
| **Ordered** | Supplier gave you a tracking number; parcel moving to the warehouse |
| **Warehoused** | Warehouse confirmed receipt (store receipt no. + photo) |
| **Delivered** | Arrived at your house — done |
| **Lost** | Never showed up (kept for the record) |

Parcels sitting in *Ordered* > 14 days or *Warehoused* > 21 days are flagged as stale.
Change the limits in `src/lib/trackings.ts` (`STALE_AFTER_DAYS`).

## Setup

```sh
npm install
cp .env.example .env     # then edit ADMIN_USER / ADMIN_PASS / SESSION_SECRET
npm run dev
```

Open http://localhost:5173 and log in with the credentials from `.env`.

## Database

Raw SQL over `@libsql/client`. Tables are created automatically on first request.

- Local (default): `DATABASE_URL=file:data/trackings.db`
- Turso: `DATABASE_URL=libsql://<db>.turso.io` + `DATABASE_AUTH_TOKEN=...`

Receipt photos are stored as BLOBs in the `photos` table and served only to a
logged-in session via `/photos/<id>`. The browser resizes photos (max 1600px, JPEG)
before upload, so a typical receipt is 100-400 KB.

## Production

```sh
npm run build
node build            # adapter-node, listens on PORT (default 3000)
```

Set `NODE_ENV=production` so the session cookie is marked `Secure` (requires HTTPS).
