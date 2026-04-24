// Cloudflare Worker — Proxy pra API da Anthropic
// ================================================
// Segura sua x-api-key server-side. O app do celular chama este Worker
// em vez de chamar a Anthropic direto.
//
// Deploy:
//   wrangler secret put ANTHROPIC_API_KEY   (cole sua sk-ant-...)
//   wrangler secret put ALLOWED_ORIGIN       (cole https://seu-dominio.github.io)
//   wrangler deploy
//
// O Worker aceita apenas:
//  - POST em /v1/messages (mesmo contrato da Anthropic)
//  - OPTIONS pro preflight CORS
//  - GET em /health (pra debug)
//
// Rate limit: 20 req/min por IP (guarda em KV opcional — se não tiver, passa livre)

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

function corsHeaders(origin, allowed) {
  const allowOrigin = allowed === "*" || origin === allowed ? origin || "*" : allowed;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

// Rate limit simples em memória (vale por isolate; não é global, mas protege picos)
const rateMap = new Map();
function checkRate(ip, limitPerMin = 20) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const hits = (rateMap.get(ip) || []).filter((t) => t > windowStart);
  if (hits.length >= limitPerMin) return false;
  hits.push(now);
  rateMap.set(ip, hits);
  return true;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "*";
    const cors = corsHeaders(origin, allowed);

    // Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Health check
    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true, ts: Date.now() }, 200, cors);
    }

    // Só aceita POST no endpoint esperado
    if (request.method !== "POST" || url.pathname !== "/v1/messages") {
      return jsonResponse(
        { error: "Method not allowed. Use POST /v1/messages." },
        405,
        cors
      );
    }

    // Valida origem (bloqueia se vier de outro site)
    if (allowed !== "*" && origin !== allowed) {
      return jsonResponse(
        { error: "Origin not allowed", origin, expected: allowed },
        403,
        cors
      );
    }

    // Rate limit por IP
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!checkRate(ip, 20)) {
      return jsonResponse(
        { error: "Too many requests. Try again in 1 minute." },
        429,
        cors
      );
    }

    // Valida que a env var existe
    if (!env.ANTHROPIC_API_KEY) {
      return jsonResponse(
        { error: "Server misconfigured: ANTHROPIC_API_KEY not set." },
        500,
        cors
      );
    }

    // Repassa o body pra Anthropic adicionando a chave
    let body;
    try {
      body = await request.text();
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400, cors);
    }

    // Limita tamanho do payload (evita abuso — imagem já comprimida deveria ter <500KB)
    if (body.length > 2_000_000) {
      return jsonResponse({ error: "Payload too large (max 2MB)." }, 413, cors);
    }

    let upstream;
    try {
      upstream = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": env.ANTHROPIC_API_KEY,
        },
        body,
      });
    } catch (err) {
      return jsonResponse(
        { error: "Upstream request failed", detail: String(err) },
        502,
        cors
      );
    }

    const upstreamText = await upstream.text();
    return new Response(upstreamText, {
      status: upstream.status,
      headers: {
        ...cors,
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      },
    });
  },
};
