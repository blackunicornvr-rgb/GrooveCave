import {
  HttpError, VOTER_COOKIE, clientIp, handle, hmac, json, randomToken, readJsonBody, readVoter, sha256, verifyTurnstile
} from "../_shared/lib.js";

// GET /api/voter — indica si el navegador ya tiene una sesión de votante válida.
export const onRequestGet = handle(async ({ request, env }) => json({ active: Boolean(await readVoter(env, request)) }));

// POST /api/voter { turnstileToken } — crea una sesión de votante anónima tras superar Turnstile.
// Límite: 3 sesiones nuevas por IP cada 24 h, para dificultar el voto masivo con navegadores nuevos.
export const onRequestPost = handle(async ({ request, env }) => {
  if (!env.VOTE_SECRET || env.VOTE_SECRET.length < 24) throw new HttpError(503, "Las votaciones no están configuradas todavía (falta VOTE_SECRET).");
  const existing = await readVoter(env, request);
  if (existing) return json({ active: true });

  const data = await readJsonBody(request, 5000);
  await verifyTurnstile(env, request, data.turnstileToken);

  const ipHash = await sha256(`${env.VOTE_SECRET}:${clientIp(request)}`);
  const recent = await env.GROOVECAVE_DB.prepare(
    "SELECT COUNT(*) AS total FROM voters WHERE ip_hash = ? AND created_at >= datetime('now', '-1 day')"
  ).bind(ipHash).first();
  if (Number(recent?.total || 0) >= 3) throw new HttpError(429, "Se han creado demasiadas sesiones de voto desde esta conexión hoy.");

  const id = randomToken(16);
  await env.GROOVECAVE_DB.prepare("INSERT INTO voters (id, ip_hash) VALUES (?, ?)").bind(id, ipHash).run();
  const cookie = `${VOTER_COOKIE}=${id}.${await hmac(env.VOTE_SECRET, id)}; Path=/api; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`;
  return json({ active: true }, 201, { "Set-Cookie": cookie });
});
