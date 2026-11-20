import { bandFromKey, handle, json, rateLimit, readJsonBody } from "../_shared/lib.js";

// POST /api/band-portal { bandKey } — datos privados de la banda: sus canciones (todos los estados) y concursos.
export const onRequestPost = handle(async ({ request, env }) => {
  await rateLimit(env, request, "band_portal", 20, "-10 minutes");
  const data = await readJsonBody(request);
  const band = await bandFromKey(env, data.bandKey);
  const { results: tracks } = await env.GROOVECAVE_DB.prepare(
    "SELECT id, title, genre, status, created_at FROM tracks WHERE band_id = ? ORDER BY created_at DESC"
  ).bind(band.id).all();
  const { results: entries } = await env.GROOVECAVE_DB.prepare(`
    SELECT c.id AS contest_id, c.title, c.type, c.status, e.track_id
    FROM contest_entries e JOIN contests c ON c.id = e.contest_id
    WHERE e.band_id = ? AND e.status = 'active' ORDER BY c.closes_at DESC
  `).bind(band.id).all();
  return json({
    band: { id: band.id, name: band.name, slug: band.slug, genre: band.genre, followers: band.followers_count },
    tracks,
    entries
  });
});
