// Pruebas de la API con D1 simulado sobre SQLite real (node:sqlite), R2 en memoria y Turnstile/Spotify simulados.
// Ejecutar: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { D1, R2 } from "./mocks.mjs";

import * as bands from "../web/functions/api/bands/index.js";
import * as bandSlug from "../web/functions/api/bands/[slug].js";
import * as tracks from "../web/functions/api/tracks/index.js";
import * as audio from "../web/functions/api/audio/[[path]].js";
import * as portal from "../web/functions/api/band-portal.js";
import * as voterApi from "../web/functions/api/voter.js";
import * as contests from "../web/functions/api/contests/index.js";
import * as contest from "../web/functions/api/contests/[id]/index.js";
import * as vote from "../web/functions/api/contests/[id]/vote.js";
import * as enter from "../web/functions/api/contests/[id]/enter.js";
import * as aiSubmit from "../web/functions/api/contests/[id]/ai-submit.js";
import * as perform from "../web/functions/api/contests/[id]/perform.js";
import * as admin from "../web/functions/api/admin/[[path]].js";
import * as waitlist from "../web/functions/api/waitlist.js";

// --- Simuladores ----------------------------------------------------------

let spotifyFollowersMock = null;
globalThis.fetch = async (url) => {
  const target = String(url);
  if (target.includes("turnstile")) return Response.json({ success: true, hostname: "groovecave.test" });
  if (target.includes("accounts.spotify.com")) return Response.json({ access_token: "x" });
  if (target.includes("api.spotify.com")) return Response.json({ followers: { total: spotifyFollowersMock } });
  throw new Error(`fetch inesperado: ${target}`);
};

const ADMIN = "admin-token-de-pruebas-suficientemente-largo";
const makeEnv = (extra = {}) => ({
  GROOVECAVE_DB: new D1(), GROOVECAVE_AUDIO: new R2(),
  TURNSTILE_SECRET_KEY: "s", TURNSTILE_SITE_KEY: "k", ADMIN_TOKEN: ADMIN,
  VOTE_SECRET: "secreto-de-voto-suficientemente-largo", ...extra
});

let ipCounter = 1;
const call = async (handler, env, { method = "GET", path = "/", body, form, params = {}, headers = {}, ip } = {}) => {
  const init = { method, headers: { "CF-Connecting-IP": ip || `10.0.0.${ipCounter++}`, ...headers } };
  if (body !== undefined) { init.body = JSON.stringify(body); init.headers["Content-Type"] = "application/json"; }
  if (form) init.body = form;
  const request = new Request(`https://groovecave.test${path}`, init);
  const response = await handler({ request, env, params });
  const text = response.headers.get("Content-Type")?.includes("json") ? await response.json() : await response.arrayBuffer();
  return { status: response.status, data: text, headers: response.headers };
};
const adminCall = (env, method, segments, body) => call(admin[method === "GET" ? "onRequestGet" : "onRequestPost"], env, {
  method, body, params: { path: segments }, headers: { Authorization: `Bearer ${ADMIN}` }
});

const bandBody = (overrides = {}) => ({
  name: "Los Grillos Eléctricos", genre: "Funk", city: "Sevilla", bio: "Funk de barrio",
  email: "grillos@example.com", spotifyUrl: "https://open.spotify.com/artist/0123456789abcdefghijkl",
  followers: 4200, consent: true, turnstileToken: "ok", ...overrides
});

const audioFile = (name = "tema.mp3", type = "audio/mpeg", size = 2048) => new File([new Uint8Array(size).fill(7)], name, { type });

// Crea una banda aprobada con una canción aprobada y devuelve sus datos.
const approvedBandWithTrack = async (env, name, genre = "Funk") => {
  await call(bands.onRequestPost, env, { method: "POST", body: bandBody({ name, genre, email: `${name.replace(/\s/g, "")}@ex.com` }) });
  const { data: pending } = await adminCall(env, "GET", ["pending"]);
  const band = pending.bands.find((b) => b.name === name);
  const { data: approved } = await adminCall(env, "POST", ["bands", String(band.id)], { action: "approve" });
  const form = new FormData();
  form.set("bandKey", approved.bandKey); form.set("title", `Tema de ${name}`); form.set("genre", genre); form.set("rights", "on");
  form.set("file", audioFile());
  const upload = await call(tracks.onRequestPost, env, { method: "POST", form });
  assert.equal(upload.status, 201, JSON.stringify(upload.data));
  const { data: pending2 } = await adminCall(env, "GET", ["pending"]);
  const track = pending2.tracks.find((t) => t.band === name);
  await adminCall(env, "POST", ["tracks", String(track.id)], { action: "approve" });
  return { bandId: band.id, bandKey: approved.bandKey, trackId: track.id };
};

const voterCookie = async (env, ip) => {
  const res = await call(voterApi.onRequestPost, env, { method: "POST", body: { turnstileToken: "ok" }, ip });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.headers.get("Set-Cookie").split(";")[0];
};

// --- Pruebas --------------------------------------------------------------

test("lista de espera sigue funcionando con el esquema completo", async () => {
  const env = makeEnv();
  const res = await call(waitlist.onRequestPost, env, { method: "POST", body: { name: "Ana", email: "ana@ex.com", role: "oyente", consent: true, turnstileToken: "ok" } });
  assert.equal(res.status, 201);
});

test("registro de banda: rechaza más de 100.000 seguidores declarados o verificados", async () => {
  const env = makeEnv({ SPOTIFY_CLIENT_ID: "id", SPOTIFY_CLIENT_SECRET: "secret" });
  let res = await call(bands.onRequestPost, env, { method: "POST", body: bandBody({ followers: 150000 }) });
  assert.equal(res.status, 403);

  spotifyFollowersMock = 250000;
  res = await call(bands.onRequestPost, env, { method: "POST", body: bandBody({ followers: 1000 }) });
  assert.equal(res.status, 403);
  assert.match(res.data.error, /Spotify/);

  spotifyFollowersMock = 8000;
  res = await call(bands.onRequestPost, env, { method: "POST", body: bandBody({ followers: 1000 }) });
  assert.equal(res.status, 201);
  assert.equal(res.data.verifiedWithSpotify, true);
  const { data } = await adminCall(env, "GET", ["pending"]);
  assert.equal(data.bands[0].followers_count, 8000);
  assert.equal(data.bands[0].followers_source, "spotify");
  spotifyFollowersMock = null;
});

test("registro de banda: validaciones básicas", async () => {
  const env = makeEnv();
  assert.equal((await call(bands.onRequestPost, env, { method: "POST", body: bandBody({ genre: "Trap" }) })).status, 400);
  assert.equal((await call(bands.onRequestPost, env, { method: "POST", body: bandBody({ consent: false }) })).status, 400);
  assert.equal((await call(bands.onRequestPost, env, { method: "POST", body: bandBody({ spotifyUrl: "https://open.spotify.com/track/xyz", otherUrl: "" }) })).status, 400);
  assert.equal((await call(bands.onRequestPost, env, { method: "POST", body: bandBody({ spotifyUrl: "", otherUrl: "" }) })).status, 400);
  const ok = await call(bands.onRequestPost, env, { method: "POST", body: bandBody({ spotifyUrl: "", otherUrl: "https://bandcamp.com/x" }) });
  assert.equal(ok.status, 201);
  // Las bandas pendientes no son públicas.
  assert.equal((await call(bands.onRequestGet, env, {})).data.bands.length, 0);
});

test("admin: requiere token", async () => {
  const env = makeEnv();
  assert.equal((await call(admin.onRequestGet, env, { params: { path: ["pending"] } })).status, 401);
  assert.equal((await call(admin.onRequestGet, env, { params: { path: ["pending"] }, headers: { Authorization: "Bearer malo" } })).status, 401);
  assert.equal((await call(admin.onRequestGet, makeEnv({ ADMIN_TOKEN: "" }), { params: { path: ["pending"] } })).status, 503);
});

test("flujo de banda: aprobar, subir canción, revisar y publicar con audio y Range", async () => {
  const env = makeEnv();
  const { bandKey, trackId } = await approvedBandWithTrack(env, "Nebula Cueva", "Soul");

  const list = await call(bands.onRequestGet, env, {});
  assert.equal(list.data.bands.length, 1);
  assert.equal(list.data.bands[0].contact_email, undefined, "no se expone el email");

  const profile = await call(bandSlug.onRequestGet, env, { params: { slug: "nebula-cueva" } });
  assert.equal(profile.status, 200);
  assert.equal(profile.data.tracks.length, 1);

  const catalog = await call(tracks.onRequestGet, env, { path: "/api/tracks?q=nebula" });
  assert.equal(catalog.data.tracks.length, 1);
  const audioPath = catalog.data.tracks[0].audioUrl.replace("/api/audio/", "").split("/");

  const full = await call(audio.onRequestGet, env, { params: { path: audioPath } });
  assert.equal(full.status, 200);
  assert.equal(full.headers.get("Content-Type"), "audio/mpeg");
  const partial = await call(audio.onRequestGet, env, { params: { path: audioPath }, headers: { Range: "bytes=0-99" } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("Content-Range"), "bytes 0-99/2048");

  const me = await call(portal.onRequestPost, env, { method: "POST", body: { bandKey } });
  assert.equal(me.data.tracks[0].id, trackId);
  assert.equal((await call(portal.onRequestPost, env, { method: "POST", body: { bandKey: "gc_clave_incorrecta_123456" } })).status, 401);
});

test("audio pendiente no es público pero el admin puede escucharlo", async () => {
  const env = makeEnv();
  await call(bands.onRequestPost, env, { method: "POST", body: bandBody() });
  const { data: p } = await adminCall(env, "GET", ["pending"]);
  const { data: a } = await adminCall(env, "POST", ["bands", String(p.bands[0].id)], { action: "approve" });
  const form = new FormData();
  form.set("bandKey", a.bandKey); form.set("title", "Demo"); form.set("rights", "on"); form.set("file", audioFile("a.wav", "audio/wav"));
  assert.equal((await call(tracks.onRequestPost, env, { method: "POST", form })).status, 201);
  const { data: p2 } = await adminCall(env, "GET", ["pending"]);
  const segments = p2.tracks[0].audioUrl.replace("/api/audio/", "").split("/");
  assert.equal((await call(audio.onRequestGet, env, { params: { path: segments } })).status, 404);
  assert.equal((await call(audio.onRequestGet, env, { params: { path: segments }, headers: { Authorization: `Bearer ${ADMIN}` } })).status, 200);
});

test("subida: rechaza formatos no admitidos y sin derechos", async () => {
  const env = makeEnv();
  await call(bands.onRequestPost, env, { method: "POST", body: bandBody() });
  const { data: p } = await adminCall(env, "GET", ["pending"]);
  const { data: a } = await adminCall(env, "POST", ["bands", String(p.bands[0].id)], { action: "approve" });
  const bad = new FormData();
  bad.set("bandKey", a.bandKey); bad.set("title", "x"); bad.set("rights", "on"); bad.set("file", audioFile("x.exe", "application/octet-stream"));
  assert.equal((await call(tracks.onRequestPost, env, { method: "POST", form: bad })).status, 400);
  const noRights = new FormData();
  noRights.set("bandKey", a.bandKey); noRights.set("title", "x"); noRights.set("file", audioFile());
  assert.equal((await call(tracks.onRequestPost, env, { method: "POST", form: noRights })).status, 400);
  assert.equal(env.GROOVECAVE_AUDIO.objects.size, 0);
});

test("Banda del Mes: inscripción, votos 1-5, abstención, cierre y ganadoras", async () => {
  const env = makeEnv();
  const funk = await approvedBandWithTrack(env, "Cables Rojos", "Funk");
  const funk2 = await approvedBandWithTrack(env, "Prisma Sur", "Funk");
  const soul = await approvedBandWithTrack(env, "Siroco Azul", "Soul");

  const created = await adminCall(env, "POST", ["contests"], { type: "band_month", title: "Banda del Mes · Diciembre", opensAt: "2020-01-01 00:00", closesAt: "2099-01-01 00:00" });
  assert.equal(created.status, 201);
  const contestId = String(created.data.id);

  for (const band of [funk, funk2, soul]) {
    const res = await call(enter.onRequestPost, env, { method: "POST", params: { id: contestId }, body: { bandKey: band.bandKey, trackId: band.trackId } });
    assert.equal(res.status, 201, JSON.stringify(res.data));
  }
  const again = await call(enter.onRequestPost, env, { method: "POST", params: { id: contestId }, body: { bandKey: funk.bandKey, trackId: funk.trackId } });
  assert.equal(again.status, 409);
  const stolen = await call(enter.onRequestPost, env, { method: "POST", params: { id: contestId }, body: { bandKey: funk.bandKey, trackId: soul.trackId } });
  assert.equal(stolen.status, 400, "no se puede inscribir una canción ajena");

  const { data: detail } = await call(contest.onRequestGet, env, { params: { id: contestId } });
  assert.equal(detail.entries.length, 3);
  const entryOf = (title) => detail.entries.find((e) => e.title === title).id;

  // Sin sesión de votante no se puede votar.
  assert.equal((await call(vote.onRequestPost, env, { method: "POST", params: { id: contestId }, body: { entryId: entryOf("Tema de Cables Rojos"), score: 5 } })).status, 401);

  const plan = [[5, 3, 4], [4, 4, 5], [5, 2, 4], [4, 3, 3]]; // [Cables, Prisma, Siroco] por votante
  for (let i = 0; i < plan.length; i++) {
    const cookie = await voterCookie(env, `20.0.0.${i}`);
    const titles = ["Tema de Cables Rojos", "Tema de Prisma Sur", "Tema de Siroco Azul"];
    for (let j = 0; j < 3; j++) {
      const res = await call(vote.onRequestPost, env, { method: "POST", params: { id: contestId }, headers: { Cookie: cookie }, body: { entryId: entryOf(titles[j]), score: plan[i][j] } });
      assert.equal(res.status, 200, JSON.stringify(res.data));
    }
    if (i === 3) {
      // Cambiar el voto y luego abstenerse en una entrada.
      await call(vote.onRequestPost, env, { method: "POST", params: { id: contestId }, headers: { Cookie: cookie }, body: { entryId: entryOf(titles[0]), score: 1 } });
      const abstain = await call(vote.onRequestPost, env, { method: "POST", params: { id: contestId }, headers: { Cookie: cookie }, body: { entryId: entryOf(titles[0]), score: 0 } });
      assert.equal(abstain.data.votes, 3);
      const mine = await call(contest.onRequestGet, env, { params: { id: contestId }, headers: { Cookie: cookie } });
      assert.equal(mine.data.myVotes[entryOf(titles[0])], undefined);
      assert.equal(mine.data.myVotes[entryOf(titles[1])], 3);
    }
  }
  assert.equal((await call(vote.onRequestPost, env, { method: "POST", params: { id: contestId }, headers: { Cookie: await voterCookie(env, "30.0.0.1") }, body: { entryId: entryOf("Tema de Siroco Azul"), score: 9 } })).status, 400);

  // Cookie falsificada no sirve.
  assert.equal((await call(vote.onRequestPost, env, { method: "POST", params: { id: contestId }, headers: { Cookie: `gc_voter=${"a".repeat(32)}.${"b".repeat(64)}` }, body: { entryId: entryOf("Tema de Siroco Azul"), score: 5 } })).status, 401);

  const closed = await adminCall(env, "POST", ["contests", contestId, "close"]);
  assert.equal(closed.status, 200);
  // Cables Rojos: 5,4,5 → 4.67 (3 votos) ; Prisma Sur: 3,4,2,3 → 3 ; Siroco Azul: 4,5,4,3 → 4
  assert.equal(closed.data.byGenre.Funk.title, "Tema de Cables Rojos");
  assert.equal(closed.data.byGenre.Soul.title, "Tema de Siroco Azul");
  assert.equal(closed.data.overall.title, "Tema de Cables Rojos");

  const after = await call(contest.onRequestGet, env, { params: { id: contestId } });
  assert.equal(after.data.contest.phase, "closed");
  assert.equal(after.data.winners.overall, entryOf("Tema de Cables Rojos"));
  const lateVote = await call(vote.onRequestPost, env, { method: "POST", params: { id: contestId }, headers: { Cookie: await voterCookie(env, "40.0.0.1") }, body: { entryId: entryOf("Tema de Prisma Sur"), score: 5 } });
  assert.equal(lateVote.status, 409);
});

test("votantes: máximo 3 sesiones nuevas por IP al día", async () => {
  const env = makeEnv();
  for (let i = 0; i < 3; i++) await voterCookie(env, "50.0.0.1");
  const res = await call(voterApi.onRequestPost, env, { method: "POST", body: { turnstileToken: "ok" }, ip: "50.0.0.1" });
  assert.equal(res.status, 429);
});

test("concurso IA: envío, revisión, votación, ganadora y banda en directo", async () => {
  const env = makeEnv();
  const created = await adminCall(env, "POST", ["contests"], { type: "ai_song", title: "IA Funk · Diciembre", genre: "Funk", opensAt: "2020-01-01", closesAt: "2099-01-01" });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  assert.equal((await adminCall(env, "POST", ["contests"], { type: "ai_song", title: "Sin género", opensAt: "2020-01-01", closesAt: "2099-01-01" })).status, 400);
  const contestId = String(created.data.id);

  const submit = async (title, mail) => {
    const form = new FormData();
    Object.entries({ title, creatorName: "Creador", email: mail, aiTool: "Suno", notes: "", rights: "on", consent: "on", "cf-turnstile-response": "ok" })
      .forEach(([k, v]) => form.set(k, v));
    form.set("file", audioFile("ia.mp3"));
    return call(aiSubmit.onRequestPost, env, { method: "POST", params: { id: contestId }, form });
  };
  assert.equal((await submit("Robot Groove", "a@ex.com")).status, 201);
  assert.equal((await submit("Robot Groove 2", "a@ex.com")).status, 409, "una canción por persona");
  assert.equal((await submit("Silicon Soulfunk", "b@ex.com")).status, 201);

  // Pendientes no aparecen como entradas.
  assert.equal((await call(contest.onRequestGet, env, { params: { id: contestId } })).data.entries.length, 0);
  const { data: p } = await adminCall(env, "GET", ["pending"]);
  assert.equal(p.aiSongs.length, 2);
  for (const song of p.aiSongs) await adminCall(env, "POST", ["ai-songs", String(song.id)], { action: "approve" });

  const { data: detail } = await call(contest.onRequestGet, env, { params: { id: contestId } });
  assert.equal(detail.entries.length, 2);
  assert.equal(detail.entries[0].genre, "Funk");
  assert.ok(detail.entries[0].audioUrl);
  const robot = detail.entries.find((e) => e.title === "Robot Groove").id;
  const silicon = detail.entries.find((e) => e.title === "Silicon Soulfunk").id;
  for (let i = 0; i < 3; i++) {
    const cookie = await voterCookie(env, `60.0.0.${i}`);
    await call(vote.onRequestPost, env, { method: "POST", params: { id: contestId }, headers: { Cookie: cookie }, body: { entryId: robot, score: 5 } });
    await call(vote.onRequestPost, env, { method: "POST", params: { id: contestId }, headers: { Cookie: cookie }, body: { entryId: silicon, score: 2 } });
  }

  // Antes de cerrar nadie puede ofrecerse para tocarla.
  const band = await approvedBandWithTrack(env, "La Cueva Brass", "Afrobeat");
  assert.equal((await call(perform.onRequestPost, env, { method: "POST", params: { id: contestId }, body: { bandKey: band.bandKey } })).status, 409);

  const closed = await adminCall(env, "POST", ["contests", contestId, "close"]);
  assert.equal(closed.data.overall.title, "Robot Groove");

  const apply = await call(perform.onRequestPost, env, { method: "POST", params: { id: contestId }, body: { bandKey: band.bandKey, message: "¡La tocamos con vientos!" } });
  assert.equal(apply.status, 201);
  assert.equal((await call(perform.onRequestPost, env, { method: "POST", params: { id: contestId }, body: { bandKey: band.bandKey } })).status, 409);
  const { data: p2 } = await adminCall(env, "GET", ["pending"]);
  assert.equal(p2.applications.length, 1);

  const assign = await adminCall(env, "POST", ["contests", contestId, "performance"], { bandId: p2.applications[0].band_id, eventDate: "2026-12-20 21:00", venue: "Sala Even, Sevilla" });
  assert.equal(assign.status, 200, JSON.stringify(assign.data));
  const final = await call(contest.onRequestGet, env, { params: { id: contestId } });
  assert.equal(final.data.performance.band, "La Cueva Brass");
  assert.equal(final.data.performance.venue, "Sala Even, Sevilla");
  assert.equal((await adminCall(env, "GET", ["pending"])).data.applications.length, 0);

  const list = await call(contests.onRequestGet, env, { path: "/api/contests?type=ai_song" });
  assert.equal(list.data.contests.length, 1);
  assert.equal(list.data.contests[0].phase, "closed");
});

test("ganadora necesita un mínimo de votos", async () => {
  const env = makeEnv();
  const a = await approvedBandWithTrack(env, "Banda A", "Jazz");
  const created = await adminCall(env, "POST", ["contests"], { type: "band_month", title: "Mes", opensAt: "2020-01-01", closesAt: "2099-01-01" });
  const id = String(created.data.id);
  await call(enter.onRequestPost, env, { method: "POST", params: { id }, body: { bandKey: a.bandKey, trackId: a.trackId } });
  const { data } = await call(contest.onRequestGet, env, { params: { id } });
  await call(vote.onRequestPost, env, { method: "POST", params: { id }, headers: { Cookie: await voterCookie(env, "70.0.0.1") }, body: { entryId: data.entries[0].id, score: 5 } });
  const closed = await adminCall(env, "POST", ["contests", id, "close"]);
  assert.equal(closed.data.overall, null);
});

test("admin: rechazar banda por seguidores revoca su clave", async () => {
  const env = makeEnv();
  const band = await approvedBandWithTrack(env, "Crecida", "Rock");
  const res = await adminCall(env, "POST", ["bands", String(band.bandId)], { action: "approve", followers: 120000 });
  assert.equal(res.data.status, "rejected");
  assert.equal((await call(portal.onRequestPost, env, { method: "POST", body: { bandKey: band.bandKey } })).status, 401);
  assert.equal((await call(tracks.onRequestGet, env, {})).data.tracks.length, 0, "sus canciones dejan de ser públicas");
});

test("acepta el binding R2 con el nombre AUDIO_BUCKET", async () => {
  const env = makeEnv();
  env.AUDIO_BUCKET = env.GROOVECAVE_AUDIO;
  delete env.GROOVECAVE_AUDIO;
  await approvedBandWithTrack(env, "Banda Bucket", "Folk");
  assert.equal(env.AUDIO_BUCKET.objects.size, 1);
});
