import { contestStatus, handle, json } from "../../_shared/lib.js";

// GET /api/contests?type=band_month|ai_song&state=active|closed
export const onRequestGet = handle(async ({ request, env }) => {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const state = url.searchParams.get("state");
  const filters = [];
  const values = [];
  if (["band_month", "ai_song"].includes(type)) { filters.push("c.type = ?"); values.push(type); }
  if (state === "closed") filters.push("c.status = 'closed'");
  if (state === "active") filters.push("c.status = 'open'");
  const statement = env.GROOVECAVE_DB.prepare(`
    SELECT c.id, c.type, c.title, c.genre, c.description, c.opens_at, c.closes_at, c.status, c.winner_entry_id,
           (SELECT COUNT(*) FROM contest_entries e WHERE e.contest_id = c.id AND e.status = 'active') AS entries
    FROM contests c
    ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
    ORDER BY c.status = 'closed', c.closes_at DESC LIMIT 100
  `);
  const { results } = await (values.length ? statement.bind(...values) : statement).all();
  return json({ contests: results.map((contest) => ({ ...contest, phase: contestStatus(contest) })) });
});
