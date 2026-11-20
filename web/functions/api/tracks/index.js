import {
  GENRES, HttpError, bandFromKey, genre, handle, json, rateLimit, readFormBody, storeAudio, str
} from "../../_shared/lib.js";

// GET /api/tracks?genre=Soul&q=texto — catálogo público de canciones aprobadas.
export const onRequestGet = handle(async ({ request, env }) => {
  const url = new URL(request.url);
  const filters = ["t.status = 'approved'", "b.status = 'approved'"];
  const values = [];
  const g = url.searchParams.get("genre");
  if (g && GENRES.includes(g)) { filters.push("t.genre = ?"); values.push(g); }
  const q = (url.searchParams.get("q") || "").trim().slice(0, 80);
  if (q) { filters.push("(t.title LIKE ? OR b.name LIKE ?)"); values.push(`%${q}%`, `%${q}%`); }
  const statement = env.GROOVECAVE_DB.prepare(`
    SELECT t.id, t.title, t.genre, t.r2_key, b.name AS band, b.slug AS band_slug
    FROM tracks t JOIN bands b ON b.id = t.band_id
    WHERE ${filters.join(" AND ")}
    ORDER BY t.reviewed_at DESC, t.id DESC LIMIT 200
  `);
  const { results } = await (values.length ? statement.bind(...values) : statement).all();
  return json({
    tracks: results.map(({ r2_key: key, ...track }) => ({ ...track, audioUrl: `/api/audio/${key}` }))
  });
});

// POST /api/tracks (multipart) — una banda aprobada sube una canción con su clave privada.
// Campos: bandKey, title, genre, rights ("on"), file.
export const onRequestPost = handle(async ({ request, env }) => {
  await rateLimit(env, request, "track_upload", 10, "-1 hour");
  const form = await readFormBody(request);
  const band = await bandFromKey(env, form.get("bandKey"));
  const title = str(form.get("title"), { min: 1, max: 120, field: "el título" });
  const trackGenre = genre(form.get("genre") || band.genre);
  if (form.get("rights") !== "on") throw new HttpError(400, "Confirma que tienes los derechos para publicar esta canción.");

  const pending = await env.GROOVECAVE_DB.prepare(
    "SELECT COUNT(*) AS total FROM tracks WHERE band_id = ? AND status = 'pending'"
  ).bind(band.id).first();
  if (Number(pending?.total || 0) >= 5) throw new HttpError(429, "Tienes 5 canciones pendientes de revisión. Espera a que las revisemos.");

  const key = await storeAudio(env, `tracks/${band.id}`, form.get("file"));
  try {
    await env.GROOVECAVE_DB.prepare(
      "INSERT INTO tracks (band_id, title, genre, r2_key, rights_confirmed) VALUES (?, ?, ?, ?, 1)"
    ).bind(band.id, title, trackGenre, key).run();
  } catch (error) {
    await env.GROOVECAVE_AUDIO.delete(key).catch(() => {});
    throw error;
  }
  return json({ ok: true, status: "pending" }, 201);
});
