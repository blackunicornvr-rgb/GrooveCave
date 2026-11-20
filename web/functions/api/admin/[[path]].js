import {
  GENRES, HttpError, MAX_FOLLOWERS, entryResults, handle, intId, json, optionalUrl, pickWinners,
  randomToken, readJsonBody, requireAdmin, sha256, str
} from "../../_shared/lib.js";

// Panel de administración: todas las rutas exigen `Authorization: Bearer <ADMIN_TOKEN>`.
//
// GET  /api/admin/pending                      → bandas, canciones, canciones IA y ofertas de directo pendientes
// GET  /api/admin/contests                     → todos los concursos
// GET  /api/admin/waitlist                     → últimas solicitudes de la lista de espera
// POST /api/admin/bands/:id      { action: approve|reject|new-key, followers? }
// POST /api/admin/tracks/:id     { action: approve|reject }
// POST /api/admin/ai-songs/:id   { action: approve|reject }
// POST /api/admin/entries/:id    { action: withdraw }
// POST /api/admin/contests       { type, title, genre?, description?, opensAt, closesAt }
// POST /api/admin/contests/:id/close
// POST /api/admin/contests/:id/performance { bandId, eventDate?, venue?, videoUrl?, status? }

const DATE_RE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/;
const toSqlDate = (value, field) => {
  const text = String(value || "").trim().replace("T", " ");
  if (!DATE_RE.test(text)) throw new HttpError(400, `${field}: usa el formato AAAA-MM-DD HH:MM (UTC).`);
  if (text.length === 10) return `${text} 00:00:00`;
  return text.length === 16 ? `${text}:00` : text;
};

const reviewAction = (data, allowed = ["approve", "reject"]) => {
  if (!allowed.includes(data.action)) throw new HttpError(400, "Acción no válida.");
  return data.action;
};

const routes = {
  "GET pending": async (env) => {
    const db = env.GROOVECAVE_DB;
    const [bands, tracks, aiSongs, applications] = await Promise.all([
      db.prepare("SELECT id, name, genre, city, bio, contact_email, spotify_url, other_url, followers_count, followers_source, created_at FROM bands WHERE status = 'pending' ORDER BY created_at").all(),
      db.prepare("SELECT t.id, t.title, t.genre, t.r2_key, t.created_at, b.name AS band FROM tracks t JOIN bands b ON b.id = t.band_id WHERE t.status = 'pending' ORDER BY t.created_at").all(),
      db.prepare("SELECT s.id, s.title, s.creator_name, s.creator_email, s.ai_tool, s.notes, s.r2_key, s.created_at, c.title AS contest, c.genre FROM ai_songs s JOIN contests c ON c.id = s.contest_id WHERE s.status = 'pending' ORDER BY s.created_at").all(),
      db.prepare(`SELECT a.id, a.contest_id, a.message, a.created_at, b.id AS band_id, b.name AS band, b.genre, c.title AS contest
                  FROM performance_applications a JOIN bands b ON b.id = a.band_id JOIN contests c ON c.id = a.contest_id
                  WHERE NOT EXISTS (SELECT 1 FROM performances p WHERE p.contest_id = a.contest_id AND p.status != 'cancelled')
                  ORDER BY a.created_at`).all()
    ]);
    const withAudio = (rows) => rows.map(({ r2_key: key, ...row }) => ({ ...row, audioUrl: `/api/audio/${key}` }));
    return json({ bands: bands.results, tracks: withAudio(tracks.results), aiSongs: withAudio(aiSongs.results), applications: applications.results });
  },

  "GET contests": async (env) => {
    const { results } = await env.GROOVECAVE_DB.prepare(`
      SELECT c.*, (SELECT COUNT(*) FROM contest_entries e WHERE e.contest_id = c.id AND e.status = 'active') AS entries
      FROM contests c ORDER BY c.created_at DESC LIMIT 200
    `).all();
    return json({ contests: results });
  },

  "GET waitlist": async (env) => {
    const { results } = await env.GROOVECAVE_DB.prepare(
      "SELECT id, name, email, role, message, created_at FROM waitlist ORDER BY created_at DESC LIMIT 200"
    ).all();
    return json({ waitlist: results });
  },

  "POST bands/:id": async (env, data, id) => {
    const action = reviewAction(data, ["approve", "reject", "new-key"]);
    const band = await env.GROOVECAVE_DB.prepare("SELECT * FROM bands WHERE id = ?").bind(id).first();
    if (!band) throw new HttpError(404, "Banda no encontrada.");

    if (data.followers !== undefined && data.followers !== null && data.followers !== "") {
      const followers = Number(data.followers);
      if (!Number.isInteger(followers) || followers < 0) throw new HttpError(400, "Seguidores no válidos.");
      if (followers > MAX_FOLLOWERS) {
        await env.GROOVECAVE_DB.prepare("UPDATE bands SET status = 'rejected', key_hash = NULL, reviewed_at = datetime('now') WHERE id = ?").bind(id).run();
        return json({ ok: true, status: "rejected", reason: "Supera los 100.000 seguidores." });
      }
      await env.GROOVECAVE_DB.prepare(
        "UPDATE bands SET followers_count = ?, followers_source = 'admin', followers_checked_at = datetime('now') WHERE id = ?"
      ).bind(followers, id).run();
    }

    if (action === "reject") {
      await env.GROOVECAVE_DB.prepare("UPDATE bands SET status = 'rejected', key_hash = NULL, reviewed_at = datetime('now') WHERE id = ?").bind(id).run();
      return json({ ok: true, status: "rejected" });
    }
    if (action === "new-key" && band.status !== "approved") throw new HttpError(409, "Solo las bandas aprobadas tienen clave.");

    // La clave se muestra una sola vez: envíala a la banda por un canal privado.
    const bandKey = `gc_${randomToken(24)}`;
    await env.GROOVECAVE_DB.prepare(
      "UPDATE bands SET status = 'approved', key_hash = ?, reviewed_at = COALESCE(reviewed_at, datetime('now')) WHERE id = ?"
    ).bind(await sha256(bandKey), id).run();
    return json({ ok: true, status: "approved", bandKey, contactEmail: band.contact_email });
  },

  "POST tracks/:id": async (env, data, id) => {
    const action = reviewAction(data);
    const status = action === "approve" ? "approved" : "rejected";
    const result = await env.GROOVECAVE_DB.prepare(
      "UPDATE tracks SET status = ?, reviewed_at = datetime('now') WHERE id = ?"
    ).bind(status, id).run();
    if (!result.meta?.changes) throw new HttpError(404, "Canción no encontrada.");
    return json({ ok: true, status });
  },

  "POST ai-songs/:id": async (env, data, id) => {
    const action = reviewAction(data);
    const song = await env.GROOVECAVE_DB.prepare(
      "SELECT s.*, c.genre AS contest_genre, c.status AS contest_status FROM ai_songs s JOIN contests c ON c.id = s.contest_id WHERE s.id = ?"
    ).bind(id).first();
    if (!song) throw new HttpError(404, "Canción IA no encontrada.");
    if (action === "approve") {
      if (song.contest_status === "closed") throw new HttpError(409, "El concurso ya está cerrado.");
      await env.GROOVECAVE_DB.batch([
        env.GROOVECAVE_DB.prepare("UPDATE ai_songs SET status = 'approved', reviewed_at = datetime('now') WHERE id = ?").bind(id),
        env.GROOVECAVE_DB.prepare(`
          INSERT INTO contest_entries (contest_id, genre, ai_song_id) VALUES (?, ?, ?)
          ON CONFLICT (contest_id, ai_song_id) DO UPDATE SET status = 'active'
        `).bind(song.contest_id, song.contest_genre, id)
      ]);
      return json({ ok: true, status: "approved" });
    }
    await env.GROOVECAVE_DB.batch([
      env.GROOVECAVE_DB.prepare("UPDATE ai_songs SET status = 'rejected', reviewed_at = datetime('now') WHERE id = ?").bind(id),
      env.GROOVECAVE_DB.prepare("UPDATE contest_entries SET status = 'withdrawn' WHERE ai_song_id = ?").bind(id)
    ]);
    return json({ ok: true, status: "rejected" });
  },

  "POST entries/:id": async (env, data, id) => {
    reviewAction(data, ["withdraw"]);
    const result = await env.GROOVECAVE_DB.prepare("UPDATE contest_entries SET status = 'withdrawn' WHERE id = ?").bind(id).run();
    if (!result.meta?.changes) throw new HttpError(404, "Entrada no encontrada.");
    return json({ ok: true });
  },

  "POST contests": async (env, data) => {
    const type = data.type;
    if (!["band_month", "ai_song"].includes(type)) throw new HttpError(400, "Tipo de concurso no válido.");
    const title = str(data.title, { min: 1, max: 120, field: "el título" });
    const description = str(data.description, { max: 2000, field: "la descripción" }) || null;
    let genre = data.genre || null;
    if (type === "ai_song" && !GENRES.includes(genre)) throw new HttpError(400, "Los concursos de canciones IA necesitan un género.");
    if (type === "band_month") genre = null;
    const opensAt = toSqlDate(data.opensAt, "Apertura");
    const closesAt = toSqlDate(data.closesAt, "Cierre");
    if (closesAt <= opensAt) throw new HttpError(400, "El cierre debe ser posterior a la apertura.");
    const result = await env.GROOVECAVE_DB.prepare(
      "INSERT INTO contests (type, title, genre, description, opens_at, closes_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(type, title, genre, description, opensAt, closesAt).run();
    return json({ ok: true, id: result.meta?.last_row_id }, 201);
  },

  "POST contests/:id/close": async (env, _data, id) => {
    const contest = await env.GROOVECAVE_DB.prepare("SELECT * FROM contests WHERE id = ?").bind(id).first();
    if (!contest) throw new HttpError(404, "Concurso no encontrado.");
    if (contest.status === "closed") throw new HttpError(409, "El concurso ya está cerrado.");
    const entries = await entryResults(env, id);
    const { byGenre, overall } = pickWinners(entries);
    await env.GROOVECAVE_DB.prepare(
      "UPDATE contests SET status = 'closed', winner_entry_id = ?, closed_at = datetime('now') WHERE id = ?"
    ).bind(overall?.id ?? null, id).run();
    return json({ ok: true, overall, byGenre });
  },

  "POST contests/:id/performance": async (env, data, id) => {
    const contest = await env.GROOVECAVE_DB.prepare("SELECT * FROM contests WHERE id = ?").bind(id).first();
    if (!contest || contest.type !== "ai_song") throw new HttpError(404, "Concurso de canciones IA no encontrado.");
    if (contest.status !== "closed" || !contest.winner_entry_id) throw new HttpError(409, "Cierra el concurso con una ganadora antes de asignar banda.");
    const bandId = intId(data.bandId, "La banda");
    const band = await env.GROOVECAVE_DB.prepare("SELECT id FROM bands WHERE id = ? AND status = 'approved'").bind(bandId).first();
    if (!band) throw new HttpError(400, "La banda debe estar aprobada.");
    const eventDate = data.eventDate ? toSqlDate(data.eventDate, "Fecha del directo") : null;
    const venue = str(data.venue, { max: 160, field: "el lugar" }) || null;
    const videoUrl = optionalUrl(data.videoUrl, "el vídeo");
    const status = ["assigned", "done", "cancelled"].includes(data.status) ? data.status : "assigned";
    await env.GROOVECAVE_DB.prepare(`
      INSERT INTO performances (contest_id, band_id, event_date, venue, video_url, status) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (contest_id) DO UPDATE SET band_id = excluded.band_id, event_date = excluded.event_date,
        venue = excluded.venue, video_url = excluded.video_url, status = excluded.status
    `).bind(id, bandId, eventDate, venue, videoUrl, status).run();
    return json({ ok: true });
  }
};

const dispatch = async ({ request, params, env }) => {
  requireAdmin(env, request);
  const segments = (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean);
  let id;
  const pattern = segments.map((segment) => {
    if (/^\d+$/.test(segment)) { id = intId(segment); return ":id"; }
    return segment;
  }).join("/");
  const route = routes[`${request.method} ${pattern}`];
  if (!route) throw new HttpError(404, "Ruta de administración no encontrada.");
  const data = request.method === "POST" && (request.headers.get("content-type") || "").includes("application/json")
    ? await readJsonBody(request)
    : {};
  return route(env, data, id);
};

export const onRequestGet = handle(dispatch);
export const onRequestPost = handle(dispatch);
