CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(email) <= 254),
  role TEXT NOT NULL CHECK (role IN ('artista', 'oyente', 'promotor')),
  message TEXT CHECK (message IS NULL OR length(message) <= 2000),
  consent INTEGER NOT NULL CHECK (consent = 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(ip, endpoint, created_at);

-- ---- Plataforma (ver db/migrations/0002_plataforma.sql) ----
-- GrooveCave: catálogo de bandas emergentes, concursos y canciones IA.
-- Migración aditiva: no modifica las tablas waitlist ni rate_limits.

CREATE TABLE IF NOT EXISTS bands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  genre TEXT NOT NULL,
  city TEXT,
  bio TEXT CHECK (bio IS NULL OR length(bio) <= 1500),
  contact_email TEXT NOT NULL COLLATE NOCASE,
  spotify_url TEXT,
  other_url TEXT,
  followers_count INTEGER NOT NULL CHECK (followers_count >= 0 AND followers_count <= 100000),
  followers_source TEXT NOT NULL CHECK (followers_source IN ('declarado', 'spotify', 'admin')),
  followers_checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  key_hash TEXT UNIQUE,
  consent INTEGER NOT NULL CHECK (consent = 1),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_bands_status ON bands(status, genre);

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  band_id INTEGER NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  genre TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  rights_confirmed INTEGER NOT NULL CHECK (rights_confirmed = 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status, band_id);

-- type: 'band_month' (Banda del Mes) o 'ai_song' (canción IA de un género).
CREATE TABLE IF NOT EXISTS contests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('band_month', 'ai_song')),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  genre TEXT,
  description TEXT CHECK (description IS NULL OR length(description) <= 2000),
  opens_at TEXT NOT NULL,
  closes_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  winner_entry_id INTEGER,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (closes_at > opens_at),
  CHECK (type = 'band_month' OR genre IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_contests_type ON contests(type, status, closes_at);

CREATE TABLE IF NOT EXISTS ai_songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  creator_name TEXT NOT NULL CHECK (length(creator_name) BETWEEN 1 AND 100),
  creator_email TEXT NOT NULL COLLATE NOCASE,
  ai_tool TEXT NOT NULL CHECK (length(ai_tool) BETWEEN 1 AND 80),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 2000),
  r2_key TEXT NOT NULL UNIQUE,
  rights_confirmed INTEGER NOT NULL CHECK (rights_confirmed = 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  UNIQUE (contest_id, creator_email)
);
CREATE INDEX IF NOT EXISTS idx_ai_songs_status ON ai_songs(status, contest_id);

-- Una entrada es una canción de banda (Banda del Mes) o una canción IA aprobada.
CREATE TABLE IF NOT EXISTS contest_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  genre TEXT NOT NULL,
  band_id INTEGER REFERENCES bands(id) ON DELETE CASCADE,
  track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
  ai_song_id INTEGER REFERENCES ai_songs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((track_id IS NOT NULL AND band_id IS NOT NULL AND ai_song_id IS NULL) OR (ai_song_id IS NOT NULL AND track_id IS NULL)),
  UNIQUE (contest_id, band_id),
  UNIQUE (contest_id, ai_song_id)
);
CREATE INDEX IF NOT EXISTS idx_entries_contest ON contest_entries(contest_id, status);

-- Votantes anónimos: se crean tras superar Turnstile y se identifican con una cookie firmada.
CREATE TABLE IF NOT EXISTS voters (
  id TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_voters_ip ON voters(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  entry_id INTEGER NOT NULL REFERENCES contest_entries(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (entry_id, voter_id)
);
CREATE INDEX IF NOT EXISTS idx_votes_entry ON votes(entry_id);

-- Bandas que se ofrecen a tocar en directo la canción IA ganadora.
CREATE TABLE IF NOT EXISTS performance_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  band_id INTEGER NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  message TEXT CHECK (message IS NULL OR length(message) <= 1000),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (contest_id, band_id)
);

-- Banda asignada para tocar en directo la canción IA ganadora de un concurso.
CREATE TABLE IF NOT EXISTS performances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contest_id INTEGER NOT NULL UNIQUE REFERENCES contests(id) ON DELETE CASCADE,
  band_id INTEGER NOT NULL REFERENCES bands(id),
  event_date TEXT,
  venue TEXT CHECK (venue IS NULL OR length(venue) <= 160),
  video_url TEXT,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'done', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
