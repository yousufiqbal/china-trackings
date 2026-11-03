# Trackings

Small private panel to track parcels from Chinese suppliers → China warehouse → your door.

## Flow

| Status | Meaning |
|---|---|
| **Ordered** | Supplier gave you a tracking number; parcel moving to the warehouse |
| **Delivered** | Courier delivered to the warehouse, but no receipt issued yet |
| **Warehoused** | Warehouse issued the receipt (photo upload moves a parcel here) |
| **Received** | Arrived at your house, done |
| **Lost** | Never showed up (kept for the record, hidden behind the menu) |

Parcels sitting in *Ordered* > 14 days, *Delivered* > 5 days or *Warehoused* > 21 days are
flagged as stale. Change the limits in `src/lib/trackings.ts` (`STALE_AFTER_DAYS`).

## Setup

```sh
npm install
cp .env.example .env     # then edit ADMIN_USER / ADMIN_PASS / SESSION_SECRET
npm run dev
```

Open http://localhost:5173 and log in with the credentials from `.env`.

## Courier tracking (17TRACK)

Optional. Shows the courier's own events (ZTO, STO, Yunda, YTO, J&T, SF…) and flags
parcels the courier has delivered to the warehouse while they are still *Ordered*.

1. Create an account at https://api.17track.net and copy the API key into `TRACK17_KEY`.
2. In the 17TRACK dashboard set the webhook URL to `https://<your-domain>/api/track17`
   so updates arrive automatically (17TRACK re-checks every 6-12 hours).
3. Use **Sync with courier** in the menu once to register parcels added before the key was set.

New numbers are registered automatically (1 quota each; the free plan covers small volumes).
SF Express may need the receiver's phone digits and can show no events without them.

## Database

Raw SQL over `@libsql/client`. Tables are created automatically on first request.

- Local (default): `DATABASE_URL=file:data/trackings.db`
- Turso: `DATABASE_URL=libsql://<db>.turso.io` + `DATABASE_AUTH_TOKEN=...`

Receipt photos are stored as BLOBs in the `photos` table and served only to a
logged-in session via `/photos/<id>`. The browser resizes photos (max 1600px, JPEG)
before upload, so a typical receipt is 100-400 KB.

## Production

Deploys to Vercel (adapter-vercel). Import the repo, framework preset "SvelteKit", and add
these Environment Variables in the Vercel project settings:

`ADMIN_USER`, `ADMIN_PASS`, `SESSION_SECRET`, `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `TRACK17_KEY` (optional)

Photos live in Turso, so nothing is written to disk.
