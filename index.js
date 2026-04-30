const fs = require("fs");
const path = require("path");

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

module.exports = function handler(request, response) {
  const url = new URL(request.url, "https://example.com");
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
