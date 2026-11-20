import {
  HttpError, contestStatus, email, handle, intId, json, rateLimit, readFormBody, storeAudio, str, verifyTurnstile
} from "../../../_shared/lib.js";

// POST /api/contests/:id/ai-submit (multipart) — envío de una canción creada con IA para un concurso de género.
// Campos: title, creatorName, email, aiTool, notes, rights ("on"), consent ("on"), file, cf-turnstile-response, website.
export const onRequestPost = handle(async ({ request, params, env }) => {
  const contestId = intId(params.id);
  await rateLimit(env, request, "ai_submit", 3, "-1 hour");
  const form = await readFormBody(request);
  if (String(form.get("website") || "").trim()) return json({ ok: true }, 201);

  const contest = await env.GROOVECAVE_DB.prepare("SELECT * FROM contests WHERE id = ?").bind(contestId).first();
  if (!contest || contest.type !== "ai_song") throw new HttpError(404, "Concurso de canciones IA no encontrado.");
  if (!["open", "upcoming"].includes(contestStatus(contest))) throw new HttpError(409, "Los envíos de este concurso están cerrados.");

  const title = str(form.get("title"), { min: 1, max: 120, field: "el título" });
  const creatorName = str(form.get("creatorName"), { min: 1, max: 100, field: "tu nombre" });
  const creatorEmail = email(form.get("email"));
  const aiTool = str(form.get("aiTool"), { min: 1, max: 80, field: "la herramienta de IA" });
  const notes = str(form.get("notes"), { max: 2000, field: "las notas" }) || null;
  if (form.get("rights") !== "on") throw new HttpError(400, "Confirma que las condiciones de la herramienta de IA te permiten presentar y ceder la canción para su interpretación en directo.");
  if (form.get("consent") !== "on") throw new HttpError(400, "Debes aceptar la información de privacidad.");

  await verifyTurnstile(env, request, String(form.get("cf-turnstile-response") || ""));

  const duplicate = await env.GROOVECAVE_DB.prepare(
    "SELECT 1 FROM ai_songs WHERE contest_id = ? AND creator_email = ?"
  ).bind(contestId, creatorEmail).first();
  if (duplicate) throw new HttpError(409, "Ya has enviado una canción a este concurso.");

  const key = await storeAudio(env, `ai/${contestId}`, form.get("file"));
  try {
    await env.GROOVECAVE_DB.prepare(`
      INSERT INTO ai_songs (contest_id, title, creator_name, creator_email, ai_tool, notes, r2_key, rights_confirmed)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).bind(contestId, title, creatorName, creatorEmail, aiTool, notes, key).run();
  } catch (error) {
    await env.GROOVECAVE_AUDIO.delete(key).catch(() => {});
    throw error;
  }
  return json({ ok: true, status: "pending" }, 201);
});
