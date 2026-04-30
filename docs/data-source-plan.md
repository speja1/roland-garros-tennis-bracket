# Data Source Plan

## Current Roland-Garros Timing

Roland-Garros 2026 is listed by the official tournament site as running from May 18 to June 7, 2026. ESPN's 2026 Roland-Garros bracket page exists, but as of April 30, 2026 it shows TBD slots for the main draw.

That means the app should support this sequence:

1. Create the tournament before the draw is published.
2. Poll or manually import once draw data appears.
3. Open bracket submissions after the draw is complete.
4. Lock submissions before first main-draw match.

## Candidate Sources

### ESPN

Example:

`https://www.espn.com/tennis/french-open/bracket/_/season/2026`

Structured scoreboard endpoint:

`https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard?dates=20260524`

Pros:

- Public pages exist for Roland-Garros by year.
- 2025 pages are populated and useful for parser testing.
- The page structure already represents a full bracket.
- The scoreboard JSON endpoint exposes events, groupings, competitions, competitors, winners, status, round names, and scores.
- For Grand Slam dates, the ATP scoreboard endpoint can include both men's and women's singles groupings.

Cons:

- Public page format can change.
- The endpoint is not a formal public API contract.
- Parser must run server-side.
- Bot/JavaScript verification can block automated fetches, so this should not be the only import path.
- Scoreboard data is better for updating match results than for seeding the original full bracket.

Recommended use:

- MVP/private challenge result updater.
- Keep a manual admin import/fix screen.

Implementation in this prototype:

- `GET /api/sync/espn?dates=20260524-20260607&tournament=Roland%20Garros`
- Fetches ESPN scoreboard JSON for each requested date.
- Filters to Roland-Garros main-draw men's/women's singles.
- Returns normalized completed matches.
- The browser applies those results to the local bracket by matching event, round, and player names.

### Official Roland-Garros Site

Example:

`https://www.rolandgarros.com/en-us/results/SM/`

Pros:

- Canonical tournament source.
- Has draw/results pages by event.
- Useful for verification.

Cons:

- Web presentation is not the same as a documented API.
- Scraping may be more brittle than a paid feed.

Recommended use:

- Verification fallback.
- Possible primary source only after confirming stable network data in the browser.

### ATP Tour

Example:

`https://www.atptour.com/en/scores/results-archive`

Pros:

- Official ATP schedule, scores, draws, and results pages.
- Useful for men's singles verification.

Cons:

- ATP only covers the men's side, so it cannot power a combined men's + women's Grand Slam bracket challenge by itself.
- Public pages are presentation-oriented rather than a documented public JSON API.
- Site terms are restrictive around reproduction, so treat this as a verification source unless you obtain permission or use a licensed feed.

Recommended use:

- Men's-side verification only, not the primary app feed.

### Sportradar Tennis API

Pros:

- Production-grade API.
- Documented bracket/season/sport-event concepts.
- JSON/XML support and stable identifiers.

Cons:

- Paid/commercial integration.
- Requires account/API key.

Recommended use:

- Best source if this will be more than a private friend-group app.

### Other API Candidates

- BALLDONTLIE ATP/WTA APIs: promising API-key option with separate ATP and WTA products.
- Bzzoiro Tennis API: free API-key option advertising ATP/WTA live scores, rankings, results, and predictions.
- Goalserve/Data Sports Group: commercial JSON/XML feeds with tennis fixtures/results coverage.
- TheSportsDB: broad sports API, but tennis bracket coverage should be verified before relying on it.

## Ingestion Adapter Shape

Each data source should map into the same internal object:

```ts
type DrawImport = {
  tournamentSlug: string;
  eventCode: "MS" | "WS";
  source: "espn" | "roland-garros" | "sportradar" | "manual";
  sourceUrl: string;
  slots: Array<{
    slotIndex: number;
    playerName: string;
    seed?: number;
    countryCode?: string;
  }>;
  matches: Array<{
    round: number;
    matchNumber: number;
    playerAName?: string;
    playerBName?: string;
    winnerName?: string;
    status: "scheduled" | "in_progress" | "final" | "walkover" | "retired" | "unknown";
    scoreText?: string;
    scheduledAt?: string;
    sourceMatchId?: string;
  }>;
};
```

The website should never care whether data came from ESPN, Roland-Garros, Sportradar, or a manual upload.
