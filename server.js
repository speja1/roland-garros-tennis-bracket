const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const dataDir = process.env.DATA_DIR || path.join(root, "data");
const stateFile = path.join(dataDir, "state.json");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

function send(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store"
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const absolutePath = path.normalize(path.join(root, requestedPath));

  if (!absolutePath.startsWith(root)) {
    send(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(absolutePath, (error, content) => {
    if (error) {
      send(response, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }

    const type = mimeTypes[path.extname(absolutePath)] || "application/octet-stream";
    send(response, 200, content, type);
  });
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (url.pathname === "/api/sync/espn") {
    try {
      const sync = await fetchEspnSync(url.searchParams);
      send(response, 200, JSON.stringify(sync));
    } catch (error) {
      send(response, 500, JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (url.pathname !== "/api/state") {
    send(response, 404, JSON.stringify({ error: "Unknown API route." }));
    return;
  }

  if (request.method === "GET") {
    fs.readFile(stateFile, "utf8", (error, content) => {
      if (error) {
        send(response, 200, JSON.stringify({ state: null }));
        return;
      }
      send(response, 200, JSON.stringify({ state: JSON.parse(content) }));
    });
    return;
  }

  if (request.method === "PUT") {
    try {
      const body = await readBody(request);
      const parsed = JSON.parse(body);
      if (!parsed || typeof parsed !== "object" || !parsed.draws || !parsed.entries) {
        throw new Error("Invalid app state.");
      }

      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(stateFile, JSON.stringify(parsed, null, 2));
      send(response, 200, JSON.stringify({ ok: true }));
    } catch (error) {
      send(response, 400, JSON.stringify({ error: error.message }));
    }
    return;
  }

  send(response, 405, JSON.stringify({ error: "Method not allowed." }));
}

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

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/api/")) {
    handleApi(request, response);
    return;
  }

  serveStatic(request, response);
});

server.listen(port, host, () => {
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`Roland-Garros Bracket Challenge running at http://${displayHost}:${port}/`);
});
