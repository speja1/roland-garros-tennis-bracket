# Public Deployment

The cheapest durable public link for this MVP is Vercel + Supabase.

## Deploy On Vercel + Supabase

This path can run on free tiers for a friend-group MVP.

### 1. Create Supabase Project

1. Go to Supabase.
2. Create a new project.
3. Open **SQL Editor**.
4. Paste and run the SQL from:

`db/supabase-app-state.sql`

This creates one shared JSON state row location for entries, picks, draw data, results, and leaderboard data.

### 2. Supabase Values

The MVP includes public Supabase config in:

`assets/supabase-config.js`

Vercel environment variables can still override this later:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_STATE_ID`

The publishable/anon key is designed to be public. This MVP uses Row Level Security policies in `db/supabase-app-state.sql` to allow public read/write access only for the `rg-2026` state row.

### 3. Deploy On Vercel

1. Go to Vercel.
2. Import the GitHub repository:

`speja1/roland-garros-tennis-bracket`

3. Framework preset: **Other**.
4. Build command: leave empty or use `npm run check`.
5. Output directory: leave empty / project root.
6. Environment variables are optional for the current MVP because the public Supabase config is committed in `assets/supabase-config.js`. To override it, add:

| Name | Value |
| --- | --- |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anon public key |
| `SUPABASE_STATE_ID` | `rg-2026` |

7. Deploy.

Vercel will create a public URL like:

`https://roland-garros-tennis-bracket.vercel.app`

Everyone with that URL can open the bracket challenge.

## How It Works On Vercel

- Static files serve the bracket app.
- `assets/supabase-config.js` exposes the Supabase URL and anon key to the browser.
- `index.js` serves the Vercel app and exposes `/api/sync/espn`.
- Supabase stores shared state in `public.app_state`.

## Security Note

This is intentionally simple for a private friend group. Anyone with the link can technically write to the shared state row. Before using this for a larger public pool, split the state into real tables and add authentication/admin-only policies.

## Alternative: Deploy On Render

Render is easier with the current Node server, but durable storage costs more than the Vercel + Supabase path.

## Deploy On Render

1. Put this project folder in a GitHub repository.
2. Go to Render and create a new **Blueprint**.
3. Choose the repository.
4. Render will detect `render.yaml`.
5. Deploy the service.

Render will create a public URL like:

`https://roland-garros-bracket-challenge.onrender.com`

Everyone with that URL can open the bracket challenge.

## Why Render

This prototype stores shared entries, picks, results, and imported draw data in one JSON file. Render supports a small persistent disk through `render.yaml`, so the shared state can survive restarts.

Render persistent disks require a paid web service. A free web service can still run the app, but its filesystem is ephemeral, which means shared entries can disappear after restarts or deploys.

The configured persistent state location is:

`/var/data/state.json`

## Local Run

```sh
npm start
```

Then open:

`http://127.0.0.1:4173/index.html`

## Docker Run

```sh
docker build -t rg-bracket .
docker run -p 4173:4173 -v rg-bracket-data:/app/data rg-bracket
```

Then open:

`http://127.0.0.1:4173/index.html`

## Important MVP Limits

This is good for a friend group MVP. For a larger public contest, move persistence from `data/state.json` to Supabase/Postgres so simultaneous saves, authentication, admin permissions, and audit logs are robust.
