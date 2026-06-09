export async function onRequest(context) {
  const { request, env } = context;
  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_KEY = env.SUPABASE_KEY;
  const ALLOWED_ORIGIN = env.ALLOWED_ORIGIN;

  // Trata requisição CORS de pré-voo (Pre-flight OPTIONS)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN || "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  // Validação do cabeçalho Origin (opcional)
  const origin = request.headers.get("origin");
  if (ALLOWED_ORIGIN && origin && origin !== ALLOWED_ORIGIN) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verifica se as variáveis de ambiente estão configuradas no Cloudflare Pages
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(
      JSON.stringify({ error: "Supabase env vars missing on server" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Retorna as chaves de forma segura
  return new Response(
    JSON.stringify({ url: SUPABASE_URL, key: SUPABASE_KEY }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN || origin || "*",
      },
    }
  );
}
