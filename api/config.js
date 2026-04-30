module.exports = function handler(request, response) {
  const config = {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
    stateId: process.env.SUPABASE_STATE_ID || "rg-2026"
  };

  response.setHeader("content-type", "application/javascript; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(`window.RG_SUPABASE_CONFIG = ${JSON.stringify(config)};`);
};
