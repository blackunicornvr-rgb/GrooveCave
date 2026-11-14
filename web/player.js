(() => {
  // Pistas demo: tonos sintetizados al vuelo, sin material con derechos. Sustituir `notes` por `src` al conectar catálogo real.
  const TRACKS = [
    { id: "t1", title: "Pista demo 1", artist: "Artista de ejemplo", color: "#d9b26d", notes: [220, 277.18, 329.63, 277.18], seconds: 24 },
    { id: "t2", title: "Pista demo 2", artist: "Artista de ejemplo", color: "#e0875b", notes: [196, 246.94, 293.66, 392], seconds: 20 },
    { id: "t3", title: "Pista demo 3", artist: "Artista de ejemplo", color: "#8fb8a8", notes: [261.63, 329.63, 392, 329.63, 293.66], seconds: 28 },
    { id: "t4", title: "Pista demo 4", artist: "Artista de ejemplo", color: "#b9a0d6", notes: [174.61, 220, 261.63], seconds: 18 }
  ];

  const fmt = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const synthWav = ({ notes, seconds }) => {
    const rate = 16000;
    const total = rate * seconds;
    const noteLen = Math.floor(rate * 0.5);
    const buf = new ArrayBuffer(44 + total * 2);
    const v = new DataView(buf);
    const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    str(0, "RIFF"); v.setUint32(4, 36 + total * 2, true); str(8, "WAVEfmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, total * 2, true);
    for (let i = 0; i < total; i++) {
      const n = Math.floor(i / noteLen);
      const t = (i % noteLen) / rate;
      const env = Math.min(1, t * 40) * Math.exp(-t * 4);
      const f = notes[n % notes.length];
      v.setInt16(44 + i * 2, Math.sin(2 * Math.PI * f * t) * env * 0.35 * 32767, true);
    }
    return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const audio = new Audio();
  audio.preload = "none";
  let index = -1;

  const grid = $("#catalogGrid");
  const player = $("#player");
  const full = $("#playerFull");
  if (!grid || !player || !full) return;

  const els = {
    cover: $("#playerCover"), title: $("#playerTitle"), artist: $("#playerArtist"),
    play: $("#playBtn"), prev: $("#prevBtn"), next: $("#nextBtn"), fav: $("#favBtn"),
    seek: $("#seek"), cur: $("#curTime"), dur: $("#durTime"), vol: $("#volume"), open: $("#openFull"),
    fCover: $("#fullCover"), fTitle: $("#fullTitle"), fArtist: $("#fullArtist"), fPlay: $("#fullPlay"),
    fPrev: $("#fullPrev"), fNext: $("#fullNext"), fFav: $("#fullFav"), fSeek: $("#fullSeek"),
    fCur: $("#fullCur"), fDur: $("#fullDur"), close: $("#closeFull"), queue: $("#queue")
  };

  const favs = new Set();
  try { JSON.parse(localStorage.getItem("gc-favs") || "[]").forEach((id) => favs.add(id)); } catch {}

  const renderCards = () => {
    grid.innerHTML = "";
    TRACKS.forEach((t, i) => {
      const card = document.createElement("article");
      card.className = "song-card";
      card.dataset.index = i;
      card.innerHTML = `<div class="cover" style="background:${t.color}" aria-hidden="true">♫</div>
        <div class="info"><strong></strong><span></span><span class="dur">${fmt(t.seconds)}</span></div>
        <button type="button" class="icon-btn primary" aria-label="Reproducir"></button>`;
      $("strong", card).textContent = t.title;
      $(".info span", card).textContent = t.artist;
      $("button", card).textContent = "▶";
      $("button", card).addEventListener("click", () => (index === i ? toggle() : load(i, true)));
      grid.append(card);
    });
    els.queue.innerHTML = "";
    TRACKS.forEach((t, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = "<span></span><span></span>";
      b.children[0].textContent = t.title;
      b.children[1].textContent = fmt(t.seconds);
      b.addEventListener("click", () => load(i, true));
      li.append(b);
      els.queue.append(li);
    });
  };

  const setSeek = (input, value, max) => {
    input.max = String(max || 0);
    input.value = String(value || 0);
    input.style.setProperty("--pct", max ? `${(value / max) * 100}%` : "0%");
  };

  const syncState = () => {
    const playing = !audio.paused;
    [els.play, els.fPlay].forEach((b) => {
      b.textContent = playing ? "⏸" : "▶";
      b.setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
    });
    grid.querySelectorAll(".song-card").forEach((c, i) => {
      c.classList.toggle("is-current", i === index);
      const b = $("button", c);
      b.textContent = i === index && playing ? "⏸" : "▶";
      b.setAttribute("aria-label", i === index && playing ? "Pausar" : "Reproducir");
    });
    els.queue.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-current", String(i === index)));
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  };

  const syncFav = () => {
    const on = index >= 0 && favs.has(TRACKS[index].id);
    [els.fav, els.fFav].forEach((b) => {
      b.setAttribute("aria-pressed", String(on));
      b.textContent = on ? "♥" : "♡";
    });
  };

  const syncTime = () => {
    const d = audio.duration || TRACKS[index]?.seconds || 0;
    setSeek(els.seek, audio.currentTime, d);
    setSeek(els.fSeek, audio.currentTime, d);
    els.cur.textContent = els.fCur.textContent = fmt(audio.currentTime);
    els.dur.textContent = els.fDur.textContent = fmt(d);
  };

  const load = (i, autoplay) => {
    index = (i + TRACKS.length) % TRACKS.length;
    const t = TRACKS[index];
    t.url ||= t.src || synthWav(t);
    audio.src = t.url;
    player.hidden = false;
    document.body.classList.add("has-player");
    [els.cover, els.fCover].forEach((c) => (c.style.background = t.color));
    els.title.textContent = els.fTitle.textContent = t.title;
    els.artist.textContent = els.fArtist.textContent = t.artist;
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist });
    }
    syncFav();
    syncTime();
    if (autoplay) audio.play().catch(() => {});
    syncState();
  };

  const toggle = () => {
    if (index < 0) return load(0, true);
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  };
  const next = () => load(index + 1, true);
  const prev = () => (audio.currentTime > 3 ? (audio.currentTime = 0) : load(index - 1, true));

  const toggleFav = () => {
    if (index < 0) return;
    const id = TRACKS[index].id;
    favs.has(id) ? favs.delete(id) : favs.add(id);
    try { localStorage.setItem("gc-favs", JSON.stringify([...favs])); } catch {}
    syncFav();
  };

  const openFull = () => { full.hidden = false; els.close.focus(); };
  const closeFull = () => { full.hidden = true; els.open.focus(); };

  [els.play, els.fPlay].forEach((b) => b.addEventListener("click", toggle));
  [els.next, els.fNext].forEach((b) => b.addEventListener("click", next));
  [els.prev, els.fPrev].forEach((b) => b.addEventListener("click", prev));
  [els.fav, els.fFav].forEach((b) => b.addEventListener("click", toggleFav));
  [els.seek, els.fSeek].forEach((s) => s.addEventListener("input", () => { audio.currentTime = Number(s.value); syncTime(); }));
  els.vol.addEventListener("input", () => { audio.volume = Number(els.vol.value); });
  els.open.addEventListener("click", openFull);
  els.close.addEventListener("click", closeFull);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !full.hidden) closeFull(); });

  audio.addEventListener("play", syncState);
  audio.addEventListener("pause", syncState);
  audio.addEventListener("timeupdate", syncTime);
  audio.addEventListener("loadedmetadata", syncTime);
  audio.addEventListener("ended", next);
  audio.addEventListener("error", () => { if (audio.src) syncState(); });

  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", toggle);
    navigator.mediaSession.setActionHandler("pause", toggle);
    navigator.mediaSession.setActionHandler("nexttrack", next);
    navigator.mediaSession.setActionHandler("previoustrack", prev);
  }

  renderCards();
})();
