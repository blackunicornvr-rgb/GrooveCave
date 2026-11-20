import { HttpError, handle, json } from "../../_shared/lib.js";

// GET /api/bands/:slug — perfil público de una banda aprobada con sus canciones publicadas.
export const onRequestGet = handle(async ({ params, env }) => {
  const slug = String(params.slug || "").slice(0, 80);
  const band = await env.GROOVECAVE_DB.prepare(`
    SELECT id, slug, name, genre, city, bio, spotify_url, other_url, followers_count, followers_source
    FROM bands WHERE slug = ? AND status = 'approved'
  `).bind(slug).first();
  if (!band) throw new HttpError(404, "Banda no encontrada.");
  const { results } = await env.GROOVECAVE_DB.prepare(`
    SELECT id, title, genre, r2_key FROM tracks WHERE band_id = ? AND status = 'approved' ORDER BY created_at DESC
  `).bind(band.id).all();
  return json({
    band,
    tracks: results.map(({ r2_key: key, ...track }) => ({ ...track, audioUrl: `/api/audio/${key}` }))
  });
});
