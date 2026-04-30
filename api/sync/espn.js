const { fetchEspnSync } = require("../../lib/espnSync");

module.exports = async function handler(request, response) {
  try {
    const url = new URL(request.url, `https://${request.headers.host}`);
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
};
