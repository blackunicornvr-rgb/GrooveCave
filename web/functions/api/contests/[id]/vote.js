import {
  HttpError, contestStatus, handle, intId, json, rateLimit, readJsonBody, readVoter
} from "../../../_shared/lib.js";

// POST /api/contests/:id/vote { entryId, score } — score 1–5; 0 retira el voto (abstención).
export const onRequestPost = handle(async ({ request, params, env }) => {
  const contestId = intId(params.id);
  const voter = await readVoter(env, request);
  if (!voter) throw new HttpError(401, "Activa tu voto superando la comprobación anti-spam.");
  await rateLimit(env, request, "vote", 60, "-1 minute");

  const data = await readJsonBody(request, 2000);
  const entryId = intId(data.entryId, "La entrada");
  const score = Number(data.score);
  if (!Number.isInteger(score) || score < 0 || score > 5) throw new HttpError(400, "La puntuación debe ser de 1 a 5 (o 0 para no votar).");

  const contest = await env.GROOVECAVE_DB.prepare("SELECT * FROM contests WHERE id = ?").bind(contestId).first();
  if (!contest) throw new HttpError(404, "Concurso no encontrado.");
  if (contestStatus(contest) !== "open") throw new HttpError(409, "Las votaciones de este concurso no están abiertas.");

  const entry = await env.GROOVECAVE_DB.prepare(
    "SELECT id FROM contest_entries WHERE id = ? AND contest_id = ? AND status = 'active'"
  ).bind(entryId, contestId).first();
  if (!entry) throw new HttpError(404, "Entrada no encontrada en este concurso.");

  if (score === 0) {
    await env.GROOVECAVE_DB.prepare("DELETE FROM votes WHERE entry_id = ? AND voter_id = ?").bind(entryId, voter).run();
  } else {
    await env.GROOVECAVE_DB.prepare(`
      INSERT INTO votes (contest_id, entry_id, voter_id, score) VALUES (?, ?, ?, ?)
      ON CONFLICT (entry_id, voter_id) DO UPDATE SET score = excluded.score, updated_at = datetime('now')
    `).bind(contestId, entryId, voter, score).run();
  }

  const totals = await env.GROOVECAVE_DB.prepare(
    "SELECT COUNT(*) AS votes, COALESCE(AVG(score), 0) AS average FROM votes WHERE entry_id = ?"
  ).bind(entryId).first();
  return json({ ok: true, score, votes: Number(totals.votes), average: Math.round(Number(totals.average) * 100) / 100 });
});
