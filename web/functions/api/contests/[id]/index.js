import {
  HttpError, MIN_VOTES_TO_WIN, contestStatus, entryResults, handle, intId, json, pickWinners, readVoter
} from "../../../_shared/lib.js";

// GET /api/contests/:id — concurso con entradas, medias, mis votos y ganadoras (si está cerrado).
export const onRequestGet = handle(async ({ request, params, env }) => {
  const id = intId(params.id);
  const contest = await env.GROOVECAVE_DB.prepare("SELECT * FROM contests WHERE id = ?").bind(id).first();
  if (!contest) throw new HttpError(404, "Concurso no encontrado.");

  const entries = await entryResults(env, id);
  const voter = await readVoter(env, request);
  const myVotes = {};
  if (voter) {
    const { results } = await env.GROOVECAVE_DB.prepare(
      "SELECT entry_id, score FROM votes WHERE contest_id = ? AND voter_id = ?"
    ).bind(id, voter).all();
    results.forEach((row) => { myVotes[row.entry_id] = row.score; });
  }

  let winners = null;
  if (contest.status === "closed") {
    const { byGenre } = pickWinners(entries);
    winners = {
      overall: contest.winner_entry_id,
      byGenre: Object.fromEntries(Object.entries(byGenre).map(([genre, entry]) => [genre, entry.id]))
    };
  }

  let performance = null;
  if (contest.type === "ai_song") {
    performance = await env.GROOVECAVE_DB.prepare(`
      SELECT p.event_date, p.venue, p.video_url, p.status, b.name AS band, b.slug AS band_slug
      FROM performances p JOIN bands b ON b.id = p.band_id WHERE p.contest_id = ?
    `).bind(id).first();
  }

  return json({
    contest: { ...contest, phase: contestStatus(contest) },
    entries,
    myVotes,
    voterActive: Boolean(voter),
    minVotesToWin: MIN_VOTES_TO_WIN,
    winners,
    performance
  });
});
