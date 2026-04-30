function yyyymmdd(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function datesBetween(start, end) {
  const dates = [];
  const cursor = new Date(`${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}T12:00:00Z`);
  const last = new Date(`${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}T12:00:00Z`);
  while (cursor <= last) {
    dates.push(yyyymmdd(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function requestedDates(searchParams) {
  const dates = searchParams.get("dates");
  if (dates?.includes("-")) {
    const [start, end] = dates.split("-");
    if (/^\d{8}$/.test(start) && /^\d{8}$/.test(end)) return datesBetween(start, end);
  }
  if (/^\d{8}$/.test(dates || "")) return [dates];

  const today = new Date();
  return [yyyymmdd(today)];
}

function espnRoundNumber(displayName) {
  const value = String(displayName || "").toLowerCase();
  if (value.includes("qualifying")) return null;
  if (value.includes("first")) return 1;
  if (value.includes("second")) return 2;
  if (value.includes("third")) return 3;
  if (value.includes("fourth")) return 4;
  if (value.includes("quarter")) return 5;
  if (value.includes("semi")) return 6;
  if (value.includes("final")) return 7;
  return null;
}

function espnEventCode(groupingName) {
  const value = String(groupingName || "").toLowerCase();
  if (value.includes("women's singles")) return "WS";
  if (value.includes("men's singles")) return "MS";
  return null;
}

function scoreText(competitors) {
  const winner = competitors.find((competitor) => competitor.winner);
  const loser = competitors.find((competitor) => !competitor.winner);
  if (!winner || !loser) return "";

  return winner.linescores?.map((set, index) => {
    const other = loser.linescores?.[index];
    if (!other) return "";
    return `${set.value}-${other.value}${set.tiebreak ? `(${set.tiebreak})` : ""}`;
  }).filter(Boolean).join(" ") || "";
}

async function fetchEspnSync(searchParams) {
  const dates = requestedDates(searchParams);
  const tournament = String(searchParams.get("tournament") || "Roland Garros").toLowerCase();
  const matches = [];

  for (const date of dates) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard?dates=${date}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`ESPN request failed for ${date}: ${response.status}`);
    const data = await response.json();

    for (const event of data.events || []) {
      if (!String(event.name || "").toLowerCase().includes(tournament)) continue;

      for (const grouping of event.groupings || []) {
        const groupingEventCode = espnEventCode(grouping.grouping?.displayName);

        for (const competition of grouping.competitions || []) {
          const eventCode = espnEventCode(competition.type?.text) || groupingEventCode;
          if (!eventCode) continue;

          const competitors = competition.competitors || [];
          const winner = competitors.find((competitor) => competitor.winner);
          const round = espnRoundNumber(competition.round?.displayName);
          if (!winner || !round || !competition.status?.type?.completed) continue;

          matches.push({
            eventCode,
            source: "espn",
            sourceMatchId: competition.id,
            round,
            roundName: competition.round?.displayName || "",
            status: competition.status?.type?.description || "",
            scoreText: scoreText(competitors),
            winnerName: winner.athlete?.displayName || winner.athlete?.fullName || "",
            players: competitors.map((competitor) => ({
              name: competitor.athlete?.displayName || competitor.athlete?.fullName || "",
              winner: Boolean(competitor.winner)
            }))
          });
        }
      }
    }
  }

  return {
    source: "espn",
    fetchedAt: new Date().toISOString(),
    dates,
    matches
  };
}

module.exports = { fetchEspnSync };
