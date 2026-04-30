const http = require("http");
const fs = require("fs");
const path = require("path");
const { fetchEspnSync } = require("./lib/espnSync");

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
