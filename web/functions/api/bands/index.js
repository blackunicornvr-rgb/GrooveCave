import {
  GENRES, MAX_FOLLOWERS, HttpError, email, genre, handle, json, optionalUrl, rateLimit,
  readJsonBody, slugify, spotifyArtistId, spotifyFollowers, str, verifyTurnstile
} from "../../_shared/lib.js";

// GET /api/bands?genre=Funk — bandas aprobadas (datos públicos únicamente).
export const onRequestGet = handle(async ({ request, env }) => {
  const url = new URL(request.url);
  const filter = url.searchParams.get("genre");
  const where = filter && GENRES.includes(filter) ? "AND genre = ?" : "";
  const statement = env.GROOVECAVE_DB.prepare(`
    SELECT id, slug, name, genre, city, bio, spotify_url, other_url, followers_count, followers_source
    FROM bands WHERE status = 'approved' ${where} ORDER BY name LIMIT 500
  `);
  const { results } = await (where ? statement.bind(filter) : statement).all();
  return json({ bands: results, maxFollowers: MAX_FOLLOWERS, genres: GENRES });
});

// POST /api/bands — solicitud de alta de una banda emergente (queda pendiente de revisión).
export const onRequestPost = handle(async ({ request, env }) => {
  await rateLimit(env, request, "band_signup", 3, "-10 minutes");
  const data = await readJsonBody(request);
  if (typeof data.website === "string" && data.website.trim()) return json({ ok: true }, 201);

  const name = str(data.name, { min: 1, max: 100, field: "el nombre de la banda" });
  const bandGenre = genre(data.genre);
  const city = str(data.city, { max: 80, field: "la ciudad" }) || null;
  const bio = str(data.bio, { max: 1500, field: "la biografía" }) || null;
  const contact = email(data.email);
  const spotifyUrl = optionalUrl(data.spotifyUrl, "el enlace de Spotify");
  const otherUrl = optionalUrl(data.otherUrl, "el enlace adicional");
  if (data.consent !== true) throw new HttpError(400, "Debes aceptar la información de privacidad y las condiciones.");
  if (spotifyUrl && !spotifyArtistId(spotifyUrl)) throw new HttpError(400, "El enlace de Spotify debe ser el de tu perfil de artista (open.spotify.com/artist/…).");
  if (!spotifyUrl && !otherUrl) throw new HttpError(400, "Añade al menos un enlace a tu música (Spotify u otra plataforma).");

  const declared = Number(data.followers);
  if (!Number.isInteger(declared) || declared < 0) throw new HttpError(400, "Indica tu número total de seguidores (suma de plataformas).");
  if (declared > MAX_FOLLOWERS) throw new HttpError(403, "GrooveCave es solo para bandas emergentes con menos de 100.000 seguidores.");

  await verifyTurnstile(env, request, data.turnstileToken);

  // Si hay credenciales de Spotify, comprobamos el dato real; manda el mayor de los dos.
  const verified = await spotifyFollowers(env, spotifyArtistId(spotifyUrl));
  if (verified !== null && verified > MAX_FOLLOWERS) {
    throw new HttpError(403, "Según Spotify, esta banda supera los 100.000 seguidores y no puede inscribirse.");
  }
  const followers = verified !== null ? Math.max(verified, declared) : declared;
  const source = verified !== null && verified >= declared ? "spotify" : "declarado";

  const base = slugify(name);
  let slug = base;
  for (let attempt = 2; await env.GROOVECAVE_DB.prepare("SELECT 1 FROM bands WHERE slug = ?").bind(slug).first(); attempt++) {
    slug = `${base}-${attempt}`;
    if (attempt > 50) throw new HttpError(409, "Ya existe una banda con ese nombre.");
  }

  await env.GROOVECAVE_DB.prepare(`
    INSERT INTO bands (slug, name, genre, city, bio, contact_email, spotify_url, other_url, followers_count, followers_source, consent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).bind(slug, name, bandGenre, city, bio, contact, spotifyUrl, otherUrl, followers, source).run();

  return json({ ok: true, verifiedWithSpotify: verified !== null }, 201);
});
