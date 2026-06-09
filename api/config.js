// Serverless endpoint to safely expose Supabase config from environment variables.
// Deploy this on Vercel (or similar) and set SUPABASE_URL, SUPABASE_KEY, ALLOWED_ORIGIN.

export default function handler(req, res) {
  const { SUPABASE_URL, SUPABASE_KEY, ALLOWED_ORIGIN } = process.env;

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN || "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  const origin = req.headers.origin;
  if (ALLOWED_ORIGIN && origin && origin !== ALLOWED_ORIGIN) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res
      .status(500)
      .json({ error: "Supabase env vars missing on server" });
  }

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN || origin || "*");

  return res.status(200).json({ url: SUPABASE_URL, key: SUPABASE_KEY });
}
