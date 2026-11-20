import { HttpError, handle, isAdmin } from "../../_shared/lib.js";

// GET /api/audio/<clave> — sirve audio desde R2 con soporte de Range (para avanzar en el reproductor).
// Solo se sirve audio aprobado; el panel de administración puede escuchar pendientes con su token.
export const onRequestGet = handle(async ({ request, params, env }) => {
  if (!env.GROOVECAVE_AUDIO) throw new HttpError(503, "El almacenamiento de audio no está configurado todavía.");
  const key = (Array.isArray(params.path) ? params.path : [params.path]).join("/");
  if (!/^(tracks|ai)\/\d+\/[0-9a-f-]{36}\.(mp3|wav|ogg|flac|aac|m4a)$/.test(key)) throw new HttpError(404, "Audio no encontrado.");

  const admin = isAdmin(env, request);
  if (!admin) {
    const published = await env.GROOVECAVE_DB.prepare(`
      SELECT 1 FROM tracks t JOIN bands b ON b.id = t.band_id WHERE t.r2_key = ? AND t.status = 'approved' AND b.status = 'approved'
      UNION ALL
      SELECT 1 FROM ai_songs WHERE r2_key = ? AND status = 'approved'
      LIMIT 1
    `).bind(key, key).first();
    if (!published) throw new HttpError(404, "Audio no encontrado.");
  }

  const object = await env.GROOVECAVE_AUDIO.get(key, { range: request.headers, onlyIf: request.headers });
  if (!object) throw new HttpError(404, "Audio no encontrado.");

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cache-Control", admin ? "private, no-store" : "public, max-age=3600");

  // Respuesta condicional (If-None-Match) sin cuerpo.
  if (!("body" in object) || !object.body) return new Response(null, { status: 304, headers });

  const range = object.range;
  if (range && request.headers.has("Range")) {
    const offset = range.offset ?? (range.suffix !== undefined ? object.size - range.suffix : 0);
    const length = range.length ?? (object.size - offset);
    headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set("Content-Length", String(length));
    return new Response(object.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { status: 200, headers });
});
