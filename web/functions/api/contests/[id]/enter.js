import {
  HttpError, bandFromKey, contestStatus, handle, intId, json, rateLimit, readJsonBody
} from "../../../_shared/lib.js";

// POST /api/contests/:id/enter { bandKey, trackId } — una banda aprobada inscribe una de sus canciones
// publicadas en la Banda del Mes. Una inscripción por banda y concurso.
export const onRequestPost = handle(async ({ request, params, env }) => {
  const contestId = intId(params.id);
  await rateLimit(env, request, "contest_enter", 10, "-10 minutes");
  const data = await readJsonBody(request, 2000);
  const band = await bandFromKey(env, data.bandKey);
  const trackId = intId(data.trackId, "La canción");

  const contest = await env.GROOVECAVE_DB.prepare("SELECT * FROM contests WHERE id = ?").bind(contestId).first();
  if (!contest || contest.type !== "band_month") throw new HttpError(404, "Concurso de Banda del Mes no encontrado.");
  if (!["open", "upcoming"].includes(contestStatus(contest))) throw new HttpError(409, "Las inscripciones de este concurso están cerradas.");

  const track = await env.GROOVECAVE_DB.prepare(
    "SELECT id, genre FROM tracks WHERE id = ? AND band_id = ? AND status = 'approved'"
  ).bind(trackId, band.id).first();
  if (!track) throw new HttpError(400, "Elige una canción tuya ya publicada en GrooveCave.");

  const existing = await env.GROOVECAVE_DB.prepare(
    "SELECT id FROM contest_entries WHERE contest_id = ? AND band_id = ?"
  ).bind(contestId, band.id).first();
  if (existing) throw new HttpError(409, "Tu banda ya está inscrita en este concurso.");

  await env.GROOVECAVE_DB.prepare(
    "INSERT INTO contest_entries (contest_id, genre, band_id, track_id) VALUES (?, ?, ?, ?)"
  ).bind(contestId, track.genre, band.id, track.id).run();
  return json({ ok: true }, 201);
});
