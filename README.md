# Roland-Garros Bracket Challenge

This is a product blueprint for a tennis bracket challenge that can ingest a Grand Slam draw, let friends submit brackets, and score those brackets as match results come in.

## Working Prototype

The current workspace includes a no-dependency browser prototype:

- `index.html` renders the app shell.
- `styles.css` handles the responsive tournament UI.
- `assets/data.js` contains sample men's and women's 128-player draws.
- `assets/app.js` handles entries, cascading picks, results, scoring, import/export, and the leaderboard.
- `local/server.js` serves the app locally, saves shared state, and exposes an ESPN results sync endpoint.
- `assets/supabase-config.js` contains the public Supabase project config for the MVP.
- `render.yaml` makes the app deployable to Render with a persistent disk.

To make the app public for everyone with a link, see `DEPLOY.md`. The cheapest durable path is Vercel + Supabase.

Run the shared prototype locally:

```sh
node server.js
```

Then open:

`http://127.0.0.1:4173/index.html`

When served this way, entries, results, imported draws, and leaderboard data are saved to `data/state.json`.

The Results Admin tab includes a **Sync ESPN** button. The app also checks ESPN every 5 minutes while it is open. The sync endpoint reads:

`https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard`

For Roland-Garros dates, ESPN's ATP scoreboard JSON includes men's and women's singles groupings. The adapter maps completed matches into the bracket by round and player names.

You can also run it as a static-only prototype:

```sh
python3 -m http.server 4173
```

Then open:

`http://127.0.0.1:4173/index.html`

Or open `index.html` directly in a browser. Static/direct-file usage stores entries, picks, results, and imported draw data in that browser's `localStorage`.

## Recommended MVP

Build the first version around the Roland-Garros men's and women's singles main draws.

- Draw size: 128 players per singles event
- Entry lock: before the first main-draw match starts
- Scoring: correct picks by round, weighted more heavily in later rounds
- Leaderboard: per event and combined men's + women's
- Data updates: server-side ingest job polls draw/results source and normalizes into your database

## Best Data Strategy

Use your own database as the source of truth for the website.

Do not make every visitor's browser scrape ESPN or Roland-Garros directly. Instead:

1. A scheduled backend job fetches the latest draw/results.
2. The job maps source data into normalized `players`, `matches`, and `draw_slots`.
3. Your website reads only from your database.
4. Scoring runs whenever match winners change.

This keeps the site fast, avoids CORS problems, gives you stable match IDs, and lets you manually fix data if a source changes format mid-tournament.

## Source Preference

1. **Paid/stable:** Sportradar Tennis API
   - Best for a reliable production app.
   - Has documented tennis bracket concepts, JSON/XML feeds, seasons, competitions, and sport event IDs.

2. **Fast MVP:** ESPN public bracket pages
   - ESPN has public Roland-Garros bracket pages by season.
   - Good enough for a friend-group MVP if you run the parser server-side and keep a manual override path.

3. **Canonical visual fallback:** Official Roland-Garros draw/results pages
   - Good as a source to verify results.
   - Not ideal as the only integration unless you confirm a stable API endpoint or accept scraping fragility.

ATP alone is not enough for the full challenge because Roland-Garros includes women's singles and is run as a Grand Slam event, not just an ATP tour event.

## Suggested Stack

- Frontend: Next.js
- Hosting: Vercel
- Database/auth: Supabase Postgres + Supabase Auth
- Scheduled ingest: Vercel Cron or Supabase Edge Function
- Admin tools: protected route for data import status, manual corrections, and scoring re-run

## Core User Flow

1. Admin creates a tournament: `roland-garros-2026`.
2. Ingest job loads the men's and women's singles draws after publication.
3. Users open your link, create a display name, and fill out picks round by round.
4. Picks lock at the configured deadline.
5. Ingest job updates actual winners as matches finish.
6. Scoring job recalculates each entry.
7. Leaderboard updates automatically.

## Scoring Recommendation

The prototype uses simple round-weighted scoring:

| Round | Points |
| --- | ---: |
| Round 1 | 1 |
| Round 2 | 2 |
| Round 3 | 4 |
| Round 4 | 8 |
| Quarterfinal | 16 |
| Semifinal | 32 |
| Final | 64 |

For a combined men's + women's challenge, total both draws.

## Important Product Rules

- Users can edit picks until the lock time.
- After lock, picks are immutable.
- A pick is correct if the selected player/team equals the official match winner.
- If a player withdraws before the tournament starts, allow admin redraw/reimport before lock.
- If a match is a walkover/retirement after lock, score according to the official advancing player.
- Store every source snapshot so parser mistakes can be audited.

## First Build Milestone

Build a working MVP with manual/sample draw JSON first:

- Render a 128-player tennis bracket.
- Let users submit picks.
- Persist entries.
- Score against an `actual_winner_id` field.
- Show leaderboard.

Then add the ESPN/Roland-Garros/Sportradar ingestion adapter once the internal model is proven.
