import {
  HttpError, bandFromKey, handle, intId, json, rateLimit, readJsonBody, str
} from "../../../_shared/lib.js";

// POST /api/contests/:id/perform { bandKey, message } — una banda se ofrece a tocar en directo
// la canción IA ganadora. El equipo elige y asigna una banda desde el panel de administración.
export const onRequestPost = handle(async ({ request, params, env }) => {
  const contestId = intId(params.id);
  await rateLimit(env, request, "perform_apply", 10, "-10 minutes");
  const data = await readJsonBody(request, 4000);
  const band = await bandFromKey(env, data.bandKey);
  const message = str(data.message, { max: 1000, field: "el mensaje" }) || null;

  const contest = await env.GROOVECAVE_DB.prepare("SELECT * FROM contests WHERE id = ?").bind(contestId).first();
  if (!contest || contest.type !== "ai_song") throw new HttpError(404, "Concurso de canciones IA no encontrado.");
  if (contest.status !== "closed" || !contest.winner_entry_id) throw new HttpError(409, "Este concurso aún no tiene canción ganadora.");
  const assigned = await env.GROOVECAVE_DB.prepare("SELECT 1 FROM performances WHERE contest_id = ? AND status != 'cancelled'").bind(contestId).first();
  if (assigned) throw new HttpError(409, "Ya hay una banda asignada para tocar esta canción.");

  try {
    await env.GROOVECAVE_DB.prepare(
      "INSERT INTO performance_applications (contest_id, band_id, message) VALUES (?, ?, ?)"
    ).bind(contestId, band.id, message).run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) throw new HttpError(409, "Tu banda ya se ha ofrecido para esta canción.");
    throw error;
  }
  return json({ ok: true }, 201);
});
