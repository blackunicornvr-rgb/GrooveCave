// Utilidades compartidas por las Pages Functions de GrooveCave.
// Este archivo no exporta handlers onRequest*, así que no genera ninguna ruta pública.

export const MAX_FOLLOWERS = 100_000;

export const GENRES = [
  "Soul", "Funk", "Afrobeat", "Jazz", "Acid Jazz", "Afro Jazz", "Swing", "Reggae",
  "Rock", "Rock Psicodélico", "Indie Rock", "Indie Pop", "Folk", "Flamenco", "Rumba", "Fusión"
];

export const AUDIO_TYPES = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a"
};
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  }
});

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Envuelve un handler: convierte HttpError en respuestas JSON y oculta errores internos.
export const handle = (fn) => async (context) => {
  try {
    if (!context.env.GROOVECAVE_DB) throw new HttpError(503, "La base de datos no está configurada todavía.");
    // El proyecto de Pages enlaza el bucket como AUDIO_BUCKET; se acepta también GROOVECAVE_AUDIO.
    const audioBucket = context.env.GROOVECAVE_AUDIO || context.env.AUDIO_BUCKET;
    return await fn({ ...context, env: { ...context.env, GROOVECAVE_AUDIO: audioBucket } });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("groovecave function failed", error);
    return json({ error: "Error interno. Inténtalo más tarde." }, 500);
  }
};

export const str = (value, { max = 200, min = 0, field = "campo" } = {}) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < min || text.length > max) {
    throw new HttpError(400, min > 0 ? `Revisa ${field} (entre ${min} y ${max} caracteres).` : `${field} no puede superar ${max} caracteres.`);
  }
  return text;
};

export const email = (value) => {
  const text = str(value, { max: 254, min: 3, field: "el email" }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) throw new HttpError(400, "Introduce un email válido.");
  return text;
};

export const genre = (value) => {
  if (!GENRES.includes(value)) throw new HttpError(400, "Selecciona un género válido.");
  return value;
};

export const intId = (value, field = "id") => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new HttpError(400, `${field} no válido.`);
  return number;
};

export const optionalUrl = (value, field = "el enlace") => {
  const text = str(value, { max: 500, field });
  if (!text) return null;
  try {
    const url = new URL(text);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error();
    return url.toString();
  } catch {
    throw new HttpError(400, `Revisa ${field}: debe ser una URL completa.`);
  }
};

export const slugify = (text) => text
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  .slice(0, 60) || "banda";

export const readJsonBody = async (request, maxBytes = 20_000) => {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new HttpError(415, "Solicitud no válida.");
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new HttpError(413, "La solicitud es demasiado grande.");
  try {
    const data = await request.json();
    if (!data || typeof data !== "object") throw new Error();
    return data;
  } catch {
    throw new HttpError(400, "No se pudo leer la solicitud.");
  }
};

export const readFormBody = async (request) => {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("multipart/form-data")) throw new HttpError(415, "Envía el formulario con el archivo adjunto.");
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_AUDIO_BYTES + 200_000) throw new HttpError(413, "El archivo supera el máximo de 25 MB.");
  try {
    return await request.formData();
  } catch {
    throw new HttpError(400, "No se pudo leer el formulario.");
  }
};

export const audioFile = (file) => {
  if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") throw new HttpError(400, "Adjunta un archivo de audio.");
  const ext = AUDIO_TYPES[file.type];
  if (!ext) throw new HttpError(400, "Formato no admitido. Usa MP3, WAV, OGG, FLAC, AAC o M4A.");
  if (file.size <= 0 || file.size > MAX_AUDIO_BYTES) throw new HttpError(413, "El archivo debe pesar como máximo 25 MB.");
  return { ext, type: file.type };
};

export const storeAudio = async (env, prefix, file) => {
  if (!env.GROOVECAVE_AUDIO) throw new HttpError(503, "El almacenamiento de audio no está configurado todavía.");
  const { ext, type } = audioFile(file);
  const key = `${prefix}/${crypto.randomUUID()}.${ext}`;
  await env.GROOVECAVE_AUDIO.put(key, file.stream ? file.stream() : await file.arrayBuffer(), {
    httpMetadata: { contentType: type }
  });
  return key;
};

export const clientIp = (request) => request.headers.get("CF-Connecting-IP") || "unknown";

export const rateLimit = async (env, request, endpoint, max, windowSql = "-1 minute") => {
  const ip = clientIp(request);
  const row = await env.GROOVECAVE_DB.prepare(
    "SELECT COUNT(*) AS total FROM rate_limits WHERE ip = ? AND endpoint = ? AND created_at >= datetime('now', ?)"
  ).bind(ip, endpoint, windowSql).first();
  if (Number(row?.total || 0) >= max) throw new HttpError(429, "Demasiadas peticiones. Inténtalo de nuevo más tarde.");
  await env.GROOVECAVE_DB.prepare(
    "INSERT INTO rate_limits (ip, endpoint, created_at) VALUES (?, ?, datetime('now'))"
  ).bind(ip, endpoint).run();
};

export const verifyTurnstile = async (env, request, token) => {
  if (!env.TURNSTILE_SECRET_KEY) throw new HttpError(503, "La protección anti-spam no está configurada todavía.");
  if (typeof token !== "string" || !token || token.length > 2048) throw new HttpError(400, "Completa la comprobación anti-spam.");
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET_KEY);
  form.append("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.append("remoteip", ip);
  let result;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    result = await response.json();
  } catch {
    throw new HttpError(502, "No se pudo verificar la comprobación anti-spam. Inténtalo de nuevo.");
  }
  if (!result.success || result.hostname !== new URL(request.url).hostname) {
    throw new HttpError(400, "La comprobación anti-spam no se ha completado. Inténtalo de nuevo.");
  }
};

// --- Criptografía ---------------------------------------------------------

const encoder = new TextEncoder();
const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

export const sha256 = async (text) => toHex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));

export const hmac = async (secret, text) => {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(text)));
};

export const safeEqual = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const randomToken = (bytes = 24) => {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return toHex(values);
};

// --- Admin ----------------------------------------------------------------

export const isAdmin = (env, request) => {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 24) return false;
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return safeEqual(token, env.ADMIN_TOKEN);
};

export const requireAdmin = (env, request) => {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 24) throw new HttpError(503, "El panel de administración no está configurado (falta ADMIN_TOKEN).");
  if (!isAdmin(env, request)) throw new HttpError(401, "No autorizado.");
};

// --- Bandas ---------------------------------------------------------------

// Las bandas reciben una clave privada al ser aprobadas; solo guardamos su hash.
export const bandFromKey = async (env, key) => {
  if (typeof key !== "string" || key.length < 20 || key.length > 200) throw new HttpError(401, "Clave de banda no válida.");
  const band = await env.GROOVECAVE_DB.prepare(
    "SELECT * FROM bands WHERE key_hash = ? AND status = 'approved'"
  ).bind(await sha256(key.trim())).first();
  if (!band) throw new HttpError(401, "Clave de banda no válida o banda no aprobada.");
  if (Number(band.followers_count) > MAX_FOLLOWERS) throw new HttpError(403, "La banda supera el límite de 100.000 seguidores.");
  return band;
};

export const spotifyArtistId = (url) => {
  if (!url) return null;
  const match = String(url).match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?artist\/([A-Za-z0-9]{22})/);
  return match ? match[1] : null;
};

// Devuelve el número de seguidores en Spotify o null si no se puede comprobar
// (sin credenciales, error de la API o campo no disponible). Nunca bloquea el registro por un fallo.
export const spotifyFollowers = async (env, artistId) => {
  if (!artistId || !env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return null;
  try {
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
    if (!tokenResponse.ok) return null;
    const { access_token: accessToken } = await tokenResponse.json();
    const artistResponse = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!artistResponse.ok) return null;
    const artist = await artistResponse.json();
    const total = artist?.followers?.total;
    return Number.isInteger(total) ? total : null;
  } catch {
    return null;
  }
};

// --- Votantes -------------------------------------------------------------

export const VOTER_COOKIE = "gc_voter";

export const readVoter = async (env, request) => {
  if (!env.VOTE_SECRET) return null;
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)gc_voter=([a-f0-9]{32})\.([a-f0-9]{64})/);
  if (!match) return null;
  const [, id, signature] = match;
  if (!safeEqual(signature, await hmac(env.VOTE_SECRET, id))) return null;
  const voter = await env.GROOVECAVE_DB.prepare("SELECT id FROM voters WHERE id = ?").bind(id).first();
  return voter ? id : null;
};

// --- Concursos ------------------------------------------------------------

export const contestStatus = (contest) => {
  if (contest.status === "closed") return "closed";
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  if (contest.opens_at && now < contest.opens_at) return "upcoming";
  if (contest.closes_at && now >= contest.closes_at) return "voting_ended";
  return "open";
};

// Resultados agregados por entrada. El mínimo de votos evita que una sola nota de 5 gane.
export const MIN_VOTES_TO_WIN = 3;

export const entryResults = async (env, contestId) => {
  const { results } = await env.GROOVECAVE_DB.prepare(`
    SELECT e.id, e.genre, e.band_id, e.track_id, e.ai_song_id,
           b.name AS band_name, b.slug AS band_slug,
           t.title AS track_title, t.r2_key AS track_key,
           s.title AS ai_title, s.creator_name, s.ai_tool, s.r2_key AS ai_key,
           COUNT(v.score) AS votes, COALESCE(AVG(v.score), 0) AS average
    FROM contest_entries e
    LEFT JOIN bands b ON b.id = e.band_id
    LEFT JOIN tracks t ON t.id = e.track_id
    LEFT JOIN ai_songs s ON s.id = e.ai_song_id
    LEFT JOIN votes v ON v.entry_id = e.id
    WHERE e.contest_id = ? AND e.status = 'active'
    GROUP BY e.id
    ORDER BY e.genre, average DESC, votes DESC, e.id
  `).bind(contestId).all();
  return results.map((row) => ({
    id: row.id,
    genre: row.genre,
    title: row.track_title || row.ai_title,
    band: row.band_name ? { id: row.band_id, name: row.band_name, slug: row.band_slug } : null,
    creator: row.creator_name || null,
    aiTool: row.ai_tool || null,
    audioUrl: row.track_key || row.ai_key ? `/api/audio/${row.track_key || row.ai_key}` : null,
    votes: Number(row.votes),
    average: Math.round(Number(row.average) * 100) / 100
  }));
};

export const rankEntries = (entries) => entries.slice().sort((a, b) =>
  (b.average - a.average) || (b.votes - a.votes) || (a.id - b.id));

export const pickWinners = (entries) => {
  const eligible = entries.filter((entry) => entry.votes >= MIN_VOTES_TO_WIN);
  const byGenre = {};
  rankEntries(eligible).forEach((entry) => {
    if (!byGenre[entry.genre]) byGenre[entry.genre] = entry;
  });
  const overall = rankEntries(Object.values(byGenre))[0] || null;
  return { byGenre, overall };
};
