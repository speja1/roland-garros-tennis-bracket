const fs = require("fs");
const path = require("path");
const { fetchEspnSync } = require("./lib/espnSync");

const dist = path.join(__dirname, "dist");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

module.exports = async function handler(request, response) {
  const url = new URL(request.url, "https://example.com");

  if (url.pathname === "/api/sync/espn") {
    try {
      const sync = await fetchEspnSync(url.searchParams);
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.setHeader("cache-control", "no-store");
      response.statusCode = 200;
      response.end(JSON.stringify(sync));
    } catch (error) {
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.statusCode = 500;
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.normalize(path.join(dist, requestedPath));

  if (!filePath.startsWith(dist)) {
    response.statusCode = 403;
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      fs.readFile(path.join(dist, "index.html"), (fallbackError, fallbackContent) => {
        if (fallbackError) {
          response.statusCode = 404;
          response.end("Not found");
          return;
        }

        response.setHeader("content-type", "text/html; charset=utf-8");
        response.end(fallbackContent);
      });
      return;
    }

    response.setHeader("content-type", mimeTypes[path.extname(filePath)] || "application/octet-stream");
    response.end(content);
  });
};
