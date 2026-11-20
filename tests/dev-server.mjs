// Servidor local que imita Cloudflare Pages: sirve web/ y enruta /api/* a las Functions
// con D1 (SQLite en memoria) y R2 simulados. Uso: node tests/dev-server.mjs [--seed] [puerto]
// Turnstile y Spotify se simulan; ADMIN_TOKEN local = "admin-local-groovecave-0123456789".
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { D1, R2 } from "./mocks.mjs";

const fn = (path) => import(new URL(`../web/functions/api/${path}`, import.meta.url));
const routes = [
  [/^\/api\/waitlist$/, "waitlist.js", () => ({})],
  [/^\/api\/bands$/, "bands/index.js", () => ({})],
  [/^\/api\/bands\/([^/]+)$/, "bands/[slug].js", (m) => ({ slug: m[1] })],
  [/^\/api\/tracks$/, "tracks/index.js", () => ({})],
  [/^\/api\/audio\/(.+)$/, "audio/[[path]].js", (m) => ({ path: m[1].split("/") })],
  [/^\/api\/band-portal$/, "band-portal.js", () => ({})],
  [/^\/api\/voter$/, "voter.js", () => ({})],
  [/^\/api\/contests$/, "contests/index.js", () => ({})],
  [/^\/api\/contests\/(\d+)$/, "contests/[id]/index.js", (m) => ({ id: m[1] })],
  [/^\/api\/contests\/(\d+)\/(vote|enter|ai-submit|perform)$/, null, (m) => ({ id: m[1] })],
  [/^\/api\/admin\/(.+)$/, "admin/[[path]].js", (m) => ({ path: m[1].split("/") })]
];

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const target = String(url);
  if (target.includes("turnstile")) return Response.json({ success: true, hostname: "localhost" });
  if (target.includes("spotify.com")) return new Response("{}", { status: 503 });
  return realFetch(url, init);
};

const ADMIN = "admin-local-groovecave-0123456789";
const env = {
  GROOVECAVE_DB: new D1(), GROOVECAVE_AUDIO: new R2(),
  TURNSTILE_SECRET_KEY: "local", TURNSTILE_SITE_KEY: "local", ADMIN_TOKEN: ADMIN, VOTE_SECRET: "voto-local-groovecave-0123456789"
};

const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };

const toRequest = async (req, port) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const headers = new Headers();
  Object.entries(req.headers).forEach(([k, v]) => headers.set(k, Array.isArray(v) ? v.join(", ") : v));
  headers.set("CF-Connecting-IP", req.socket.remoteAddress || "127.0.0.1");
  return new Request(`http://localhost:${port}${req.url}`, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body });
};

const callApi = async (request) => {
  const { pathname } = new URL(request.url);
  for (const [pattern, file, getParams] of routes) {
    const match = pathname.match(pattern);
    if (!match) continue;
    const mod = await fn(file || `contests/[id]/${match[2]}.js`);
    const handler = mod[`onRequest${request.method[0]}${request.method.slice(1).toLowerCase()}`];
    if (!handler) return new Response("Method Not Allowed", { status: 405 });
    return handler({ request, env, params: getParams(match) });
  }
  return new Response("Not found", { status: 404 });
};

// --- Datos de ejemplo -----------------------------------------------------
const wav = (freq, seconds = 6) => {
  const rate = 8000, n = rate * seconds, buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * freq * i / rate) * 8000), 44 + i * 2);
  return new File([buf], "demo.wav", { type: "audio/wav" });
};

const seed = async (port) => {
  const json = (path, method, body, headers = {}) => callApi(new Request(`http://localhost:${port}${path}`, {
    method, headers: { "Content-Type": "application/json", "CF-Connecting-IP": `9.9.${Math.random() * 250 | 0}.${Math.random() * 250 | 0}`, ...headers }, body: JSON.stringify(body)
  })).then((r) => r.json());
  const admin = (path, body) => callApi(new Request(`http://localhost:${port}/api/admin/${path}`, {
    method: body === undefined ? "GET" : "POST", headers: { Authorization: `Bearer ${ADMIN}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body)
  })).then((r) => r.json());
  const bands = [["Cables Rojos", "Funk", "Sevilla", 3200], ["Siroco Azul", "Soul", "Valencia", 18400], ["La Cueva Brass", "Afrobeat", "Madrid", 920], ["Prisma Sur", "Funk", "Málaga", 51000]];
  const keys = {};
  for (const [name, genre, city, followers] of bands) {
    await json("/api/bands", "POST", { name, genre, city, bio: `${genre} desde ${city}.`, email: `${name.replace(/\s/g, "")}@ex.com`, otherUrl: "https://bandcamp.com", followers, consent: true, turnstileToken: "x" });
  }
  await json("/api/bands", "POST", { name: "Banda Pendiente", genre: "Rock", email: "p@ex.com", otherUrl: "https://bandcamp.com", followers: 700, consent: true, turnstileToken: "x" });
  const pending = await admin("pending");
  for (const band of pending.bands.filter((b) => b.name !== "Banda Pendiente")) {
    keys[band.name] = (await admin(`bands/${band.id}`, { action: "approve" })).bandKey;
    const form = new FormData();
    form.set("bandKey", keys[band.name]); form.set("title", `Directo en ${band.city}`); form.set("genre", band.genre); form.set("rights", "on");
    form.set("file", wav(220 + band.id * 40));
    await callApi(new Request(`http://localhost:${port}/api/tracks`, { method: "POST", body: form, headers: { "CF-Connecting-IP": "8.8.8.8" } }));
  }
  for (const track of (await admin("pending")).tracks) await admin(`tracks/${track.id}`, { action: "approve" });
  const month = await admin("contests", { type: "band_month", title: "Banda del Mes · Diciembre 2026", description: "Vota tu banda favorita de cada género.", opensAt: "2026-11-01 00:00", closesAt: "2026-12-31 23:00" });
  const { tracks } = await (await callApi(new Request(`http://localhost:${port}/api/tracks`))).json();
  for (const [name, key] of Object.entries(keys)) {
    const track = tracks.find((t) => t.band === name);
    await json(`/api/contests/${month.id}/enter`, "POST", { bandKey: key, trackId: track.id });
  }
  const aiOpen = await admin("contests", { type: "ai_song", title: "IA Funk · Diciembre", genre: "Funk", description: "Envía un funk creado con IA. La ganadora la tocará una banda en directo.", opensAt: "2026-11-01", closesAt: "2026-12-31" });
  const aiClosed = await admin("contests", { type: "ai_song", title: "IA Soul · Noviembre", genre: "Soul", opensAt: "2026-10-01", closesAt: "2026-12-15" });
  for (const [contestId, title, i] of [[aiOpen.id, "Robot Groove", 1], [aiOpen.id, "Silicon Strut", 2], [aiClosed.id, "Neon Heartache", 3]]) {
    const form = new FormData();
    Object.entries({ title, creatorName: `Creador ${i}`, email: `c${i}@ex.com`, aiTool: "Suno", rights: "on", consent: "on", "cf-turnstile-response": "x" }).forEach(([k, v]) => form.set(k, v));
    form.set("file", wav(300 + i * 50));
    await callApi(new Request(`http://localhost:${port}/api/contests/${contestId}/ai-submit`, { method: "POST", body: form, headers: { "CF-Connecting-IP": `7.7.7.${i}` } }));
  }
  for (const song of (await admin("pending")).aiSongs) await admin(`ai-songs/${song.id}`, { action: "approve" });
  // Votos de ejemplo de varios votantes.
  const db = env.GROOVECAVE_DB.db;
  const entries = db.prepare("SELECT id, contest_id FROM contest_entries").all();
  for (let v = 0; v < 5; v++) {
    db.prepare("INSERT INTO voters (id, ip_hash) VALUES (?, 'seed')").run(`seed${v}`.padEnd(32, "0"));
    for (const entry of entries) db.prepare("INSERT INTO votes (contest_id, entry_id, voter_id, score) VALUES (?, ?, ?, ?)").run(entry.contest_id, entry.id, `seed${v}`.padEnd(32, "0"), 1 + ((entry.id * 3 + v) % 5));
  }
  await admin(`contests/${aiClosed.id}/close`, {});
  await admin(`contests/${aiClosed.id}/performance`, { bandId: pending.bands.find((b) => b.name === "Siroco Azul").id, eventDate: "2026-12-12 21:00", venue: "Sala Moon, Valencia" });
  console.log("Datos de ejemplo cargados. Clave de banda (Cables Rojos):", keys["Cables Rojos"]);
};

const port = Number(process.argv.find((a) => /^\d+$/.test(a)) || 8788);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let response;
    if (url.pathname.startsWith("/api/")) {
      response = await callApi(await toRequest(req, port));
    } else {
      const file = normalize(join(new URL("../web/", import.meta.url).pathname, url.pathname === "/" ? "index.html" : url.pathname));
      if (!file.includes("/web/") || file.includes("/functions/")) throw Object.assign(new Error(), { code: "ENOENT" });
      response = new Response(await readFile(file), { headers: { "Content-Type": types[extname(file)] || "application/octet-stream" } });
    }
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.writeHead(error.code === "ENOENT" ? 404 : 500);
    res.end(error.code === "ENOENT" ? "Not found" : String(error));
  }
}).listen(port, async () => {
  console.log(`GrooveCave local en http://localhost:${port} (admin: ${ADMIN})`);
  if (process.argv.includes("--seed")) await seed(port);
});
