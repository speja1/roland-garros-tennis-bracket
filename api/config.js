module.exports = function handler(request, response) {
  const config = {
    url: process.env.SUPABASE_URL || "https://askoejwreesxudiltlgn.supabase.co",
    anonKey: process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFza29landyZWVzeHVkaWx0bGduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzMxODAsImV4cCI6MjA5MzE0OTE4MH0.qHgrinjdArxw7vIt9SZX4HSJNEwc1PX3U81W-NE8Y1M",
    stateId: process.env.SUPABASE_STATE_ID || "rg-2026"
  };

  response.setHeader("content-type", "application/javascript; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(`window.RG_SUPABASE_CONFIG = ${JSON.stringify(config)};`);
};
