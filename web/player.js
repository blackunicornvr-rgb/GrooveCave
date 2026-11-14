(() => {
  const TRACKS = [
    { id: "t1", title: "Pista demo 1", artist: "Artista de ejemplo", color: "#d9b26d", notes: [220, 277.18, 329.63, 277.18], seconds: 24 },
    { id: "t2", title: "Pista demo 2", artist: "Artista de ejemplo", color: "#e0875b", notes: [196, 246.94, 293.66, 392], seconds: 20 },
    { id: "t3", title: "Pista demo 3", artist: "Artista de ejemplo", color: "#8fb8a8", notes: [261.63, 329.63, 392, 329.63, 293.66], seconds: 28 },
    { id: "t4", title: "Pista demo 4", artist: "Artista de ejemplo", color: "#b9a0d6", notes: [174.61, 220, 261.63], seconds: 18 }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const fmt = (seconds) => {
    const value = Math.max(0, Math.floor(seconds || 0));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
  };
  const readJSON = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value ?? fallback;
    } catch {
      return fallback;
    }
  };
  const audio = new Audio();
  audio.preload = "metadata";
  const grid = $("#catalogGrid");
  const player = $("#player");
  const full = $("#playerFull");
  if (!grid || !player || !full) return;

  const els = {
    search: $("#catalogSearch"), favoritesOnly: $("#favoritesOnly"),
    cover: $("#playerCover"), title: $("#playerTitle"), artist: $("#playerArtist"),
    play: $("#playBtn"), prev: $("#prevBtn"), next: $("#nextBtn"), fav: $("#favBtn"),
    shuffle: $("#shuffleBtn"), repeat: $("#repeatBtn"), mute: $("#muteBtn"),
    seek: $("#seek"), cur: $("#curTime"), dur: $("#durTime"), vol: $("#volume"), open: $("#openFull"),
    fCover: $("#fullCover"), fTitle: $("#fullTitle"), fArtist: $("#fullArtist"), fPlay: $("#fullPlay"),
    fPrev: $("#fullPrev"), fNext: $("#fullNext"), fFav: $("#fullFav"),
    fShuffle: $("#fullShuffle"), fRepeat: $("#fullRepeat"),
    fSeek: $("#fullSeek"), fCur: $("#fullCur"), fDur: $("#fullDur"),
    close: $("#closeFull"), queue: $("#queue"), status: $("#playerStatus")
  };

  const saved = readJSON("gc-player", {});
  const savedFavorites = readJSON("gc-favs", []);
  const favorites = new Set(Array.isArray(savedFavorites) ? savedFavorites : []);
  let index = -1;
  let shuffle = Boolean(saved.shuffle);
  let repeat = ["off", "all", "one"].includes(saved.repeat) ? saved.repeat : "off";
  let history = [];
  let historyPosition = -1;
  let resumeAt = 0;
  let previousFocus = null;
  let previousOverflow = "";
  let lastSavedAt = 0;
  let statusTimer;
  let lastVolume = Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : 1;

  const synthWav = ({ notes, seconds }) => {
    const sampleRate = 16000;
    const samples = sampleRate * seconds;
    const bytes = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(bytes);
    const write = (offset, text) => [...text].forEach((character, i) => view.setUint8(offset + i, character.charCodeAt(0)));
    write(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); write(8, "WAVEfmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, "data");
    view.setUint32(40, samples * 2, true);
    const noteLength = Math.floor(sampleRate * 0.5);
    for (let i = 0; i < samples; i++) {
      const note = notes[Math.floor(i / noteLength) % notes.length];
      const time = (i % noteLength) / sampleRate;
      const envelope = Math.min(1, time * 40) * Math.exp(-time * 4);
      const sample = Math.sin(2 * Math.PI * note * time) * envelope * 0.35;
      view.setInt16(44 + i * 2, sample * 32767, true);
    }
    return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
  };

  const announce = (message, isError = false) => {
    clearTimeout(statusTimer);
    els.status.textContent = message;
    els.status.dataset.error = String(isError);
    if (message) statusTimer = setTimeout(() => {
      els.status.textContent = "";
      delete els.status.dataset.error;
    }, isError ? 7000 : 3500);
  };

  const persist = () => {
    try {
      localStorage.setItem("gc-player", JSON.stringify({
        trackId: TRACKS[index]?.id || saved.trackId || null,
        time: audio.currentTime || saved.time || 0,
        volume: lastVolume,
        shuffle,
        repeat
      }));
    } catch {
      announce("No se pudieron guardar tus preferencias en este navegador.", true);
    }
  };

  const setSeek = (input, value, duration) => {
    const max = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const current = Math.min(max, Math.max(0, Number(value) || 0));
    input.max = String(max);
    input.value = String(current);
    input.style.setProperty("--pct", max ? `${(current / max) * 100}%` : "0%");
  };

  const renderCards = () => {
    const query = els.search.value.trim().toLocaleLowerCase();
    const visible = TRACKS.map((track, trackIndex) => ({ track, trackIndex }))
      .filter(({ track }) => `${track.title} ${track.artist}`.toLocaleLowerCase().includes(query))
      .filter(({ track }) => !els.favoritesOnly.checked || favorites.has(track.id));
    grid.replaceChildren();

    if (!visible.length) {
      const empty = document.createElement("p");
      empty.className = "catalog-empty";
      empty.textContent = els.favoritesOnly.checked && !favorites.size
        ? "Aún no tienes favoritos. Marca el corazón de una pista para guardarla."
        : "No encontramos pistas con esa búsqueda.";
      grid.append(empty);
      return;
    }

    visible.forEach(({ track, trackIndex }) => {
      const card = document.createElement("article");
      card.className = "song-card";
      card.dataset.index = trackIndex;
      const cover = document.createElement("div");
      cover.className = "cover";
      cover.style.background = track.color;
      cover.setAttribute("aria-hidden", "true");
      cover.textContent = "♫";
      const info = document.createElement("div");
      info.className = "info";
      const title = document.createElement("strong");
      title.textContent = track.title;
      const artist = document.createElement("span");
      artist.textContent = track.artist;
      const duration = document.createElement("span");
      duration.className = "dur";
      duration.textContent = fmt(track.seconds);
      info.append(title, artist, duration);
      const play = document.createElement("button");
      play.type = "button";
      play.className = "icon-btn primary";
      play.addEventListener("click", () => index === trackIndex ? togglePlayback() : load(trackIndex, true));
      card.append(cover, info, play);
      grid.append(card);
    });
    syncState();
  };

  const renderQueue = () => {
    els.queue.replaceChildren();
    TRACKS.forEach((track, trackIndex) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      const title = document.createElement("span");
      const duration = document.createElement("span");
      title.textContent = track.title;
      duration.textContent = fmt(track.seconds);
      button.append(title, duration);
      button.addEventListener("click", () => load(trackIndex, true));
      item.append(button);
      els.queue.append(item);
    });
  };

  const syncTime = () => {
    const duration = Number.isFinite(audio.duration) ? audio.duration : TRACKS[index]?.seconds || 0;
    setSeek(els.seek, audio.currentTime, duration);
    setSeek(els.fSeek, audio.currentTime, duration);
    els.cur.textContent = els.fCur.textContent = fmt(audio.currentTime);
    els.dur.textContent = els.fDur.textContent = fmt(duration);
  };

  const syncFavorite = () => {
    const isFavorite = index >= 0 && favorites.has(TRACKS[index].id);
    [els.fav, els.fFav].forEach((button) => {
      button.setAttribute("aria-pressed", String(isFavorite));
      button.setAttribute("aria-label", isFavorite ? "Quitar de favoritos" : "Añadir a favoritos");
      button.textContent = isFavorite ? "♥" : "♡";
    });
  };

  const syncModes = () => {
    [els.shuffle, els.fShuffle].forEach((button) => button.setAttribute("aria-pressed", String(shuffle)));
    const repeatLabels = { off: "Repetición desactivada", all: "Repetir cola", one: "Repetir pista" };
    [els.repeat, els.fRepeat].forEach((button) => {
      button.setAttribute("aria-pressed", String(repeat !== "off"));
      button.setAttribute("aria-label", repeatLabels[repeat]);
      button.textContent = repeat === "one" ? "↻¹" : "↻";
    });
  };

  const syncState = () => {
    const playing = !audio.paused;
    [els.play, els.fPlay].forEach((button) => {
      button.textContent = playing ? "⏸" : "▶";
      button.setAttribute("aria-label", playing ? "Pausar" : "Reproducir");
    });
    grid.querySelectorAll(".song-card").forEach((card) => {
      const current = Number(card.dataset.index) === index;
      card.classList.toggle("is-current", current);
      const button = $("button", card);
      button.textContent = current && playing ? "⏸" : "▶";
      button.setAttribute("aria-label", current && playing ? `Pausar ${TRACKS[index].title}` : `Reproducir ${TRACKS[Number(card.dataset.index)].title}`);
    });
    els.queue.querySelectorAll("button").forEach((button, queueIndex) => {
      if (queueIndex === index) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    });
    els.mute.textContent = audio.muted || audio.volume === 0 ? "◌" : "◖";
    els.mute.setAttribute("aria-label", audio.muted || audio.volume === 0 ? "Activar sonido" : "Silenciar");
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  };

  const addHistory = (trackIndex) => {
    if (history[historyPosition] === trackIndex) return;
    history = history.slice(0, historyPosition + 1);
    history.push(trackIndex);
    historyPosition = history.length - 1;
  };

  const updateMediaSession = (track) => {
    try {
      if ("mediaSession" in navigator && "MediaMetadata" in window) {
        navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: track.artist });
      }
    } catch {
      announce("Los controles multimedia del dispositivo no están disponibles en este navegador.");
    }
  };

  const load = (trackIndex, autoplay, options = {}) => {
    if (!TRACKS.length) return;
    index = (trackIndex + TRACKS.length) % TRACKS.length;
    const track = TRACKS[index];
    if (!track.url) track.url = track.src || synthWav(track);
    resumeAt = options.restore ? Math.max(0, Number(saved.time) || 0) : 0;
    audio.src = track.url;
    player.hidden = false;
    document.body.classList.add("has-player");
    [els.cover, els.fCover].forEach((cover) => { cover.style.background = track.color; });
    els.title.textContent = els.fTitle.textContent = track.title;
    els.artist.textContent = els.fArtist.textContent = track.artist;
    updateMediaSession(track);
    if (!options.restore && !options.fromHistory) addHistory(index);
    syncFavorite();
    syncTime();
    syncState();
    if (autoplay) {
      audio.play().catch(() => announce("No se pudo iniciar la reproducción. Prueba de nuevo o revisa los ajustes de audio.", true));
    }
    persist();
  };

  const togglePlayback = () => {
    if (index < 0) return load(0, true);
    if (audio.paused) {
      audio.play().catch(() => announce("No se pudo iniciar la reproducción. Prueba de nuevo o revisa los ajustes de audio.", true));
    } else {
      audio.pause();
    }
  };

  const nextTrack = (automatic = false) => {
    if (automatic && repeat === "one") {
      audio.currentTime = 0;
      audio.play().catch(() => announce("No se pudo reanudar la pista.", true));
      return;
    }
    if (automatic && index === TRACKS.length - 1 && repeat !== "all" && !shuffle) {
      audio.pause();
      audio.currentTime = 0;
      syncTime();
      announce("Has llegado al final de la selección.");
      return;
    }
    let target;
    if (shuffle && TRACKS.length > 1) {
      const choices = TRACKS.map((_, i) => i).filter((i) => i !== index);
      target = choices[Math.floor(Math.random() * choices.length)];
    } else {
      target = (index + 1) % TRACKS.length;
    }
    load(target, true);
  };

  const previousTrack = () => {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (historyPosition > 0) {
      historyPosition--;
      load(history[historyPosition], true, { fromHistory: true });
    } else {
      load(index <= 0 ? TRACKS.length - 1 : index - 1, true);
    }
  };

  const toggleFavorite = () => {
    if (index < 0) return;
    const id = TRACKS[index].id;
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    try {
      localStorage.setItem("gc-favs", JSON.stringify([...favorites]));
    } catch {
      announce("No se pudieron guardar tus favoritos en este navegador.", true);
    }
    syncFavorite();
    renderCards();
  };

  const toggleShuffle = () => { shuffle = !shuffle; syncModes(); persist(); };
  const toggleRepeat = () => {
    repeat = ({ off: "all", all: "one", one: "off" })[repeat];
    syncModes();
    persist();
    announce(({ off: "Repetición desactivada.", all: "Se repetirá la cola.", one: "Se repetirá esta pista." })[repeat]);
  };

  const setVolume = (value) => {
    lastVolume = Math.min(1, Math.max(0, Number(value)));
    audio.volume = lastVolume;
    audio.muted = lastVolume === 0;
    els.vol.value = String(lastVolume);
    syncState();
    persist();
  };
  const toggleMute = () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      audio.volume = lastVolume || 1;
      els.vol.value = String(audio.volume);
    } else {
      lastVolume = audio.volume;
      audio.muted = true;
    }
    syncState();
    persist();
  };

  const openFull = () => {
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    full.hidden = false;
    els.close.focus();
  };
  const closeFull = () => {
    full.hidden = true;
    document.body.style.overflow = previousOverflow;
    (previousFocus instanceof HTMLElement ? previousFocus : els.open).focus();
  };
  const seekBy = (seconds) => {
    if (index < 0) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : TRACKS[index].seconds;
    audio.currentTime = Math.min(duration, Math.max(0, audio.currentTime + seconds));
    syncTime();
  };

  [els.play, els.fPlay].forEach((button) => button.addEventListener("click", togglePlayback));
  [els.next, els.fNext].forEach((button) => button.addEventListener("click", () => nextTrack()));
  [els.prev, els.fPrev].forEach((button) => button.addEventListener("click", previousTrack));
  [els.fav, els.fFav].forEach((button) => button.addEventListener("click", toggleFavorite));
  [els.shuffle, els.fShuffle].forEach((button) => button.addEventListener("click", toggleShuffle));
  [els.repeat, els.fRepeat].forEach((button) => button.addEventListener("click", toggleRepeat));
  [els.seek, els.fSeek].forEach((slider) => slider.addEventListener("input", () => {
    audio.currentTime = Number(slider.value);
    syncTime();
  }));
  els.vol.addEventListener("input", () => setVolume(els.vol.value));
  els.mute.addEventListener("click", toggleMute);
  els.search.addEventListener("input", renderCards);
  els.favoritesOnly.addEventListener("change", renderCards);
  els.open.addEventListener("click", openFull);
  els.close.addEventListener("click", closeFull);
  full.addEventListener("click", (event) => { if (event.target === full) closeFull(); });

  document.addEventListener("keydown", (event) => {
    if (!full.hidden && event.key === "Escape") {
      closeFull();
      return;
    }
    if (!full.hidden && event.key === "Tab") {
      const focusable = [...full.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select, button, a"))) return;
    if (event.code === "Space" || event.key.toLowerCase() === "k") {
      event.preventDefault();
      togglePlayback();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      seekBy(-5);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      seekBy(5);
    } else if (event.key.toLowerCase() === "j") {
      previousTrack();
    } else if (event.key.toLowerCase() === "l") {
      nextTrack();
    } else if (event.key.toLowerCase() === "m") {
      toggleMute();
    }
  });

  audio.addEventListener("play", () => { syncState(); announce(""); });
  audio.addEventListener("pause", () => { syncState(); persist(); });
  audio.addEventListener("timeupdate", () => {
    syncTime();
    if (Date.now() - lastSavedAt > 5000) {
      persist();
      lastSavedAt = Date.now();
    }
  });
  audio.addEventListener("loadedmetadata", () => {
    if (resumeAt > 0 && resumeAt < audio.duration) audio.currentTime = resumeAt;
    resumeAt = 0;
    syncTime();
  });
  audio.addEventListener("ended", () => nextTrack(true));
  audio.addEventListener("error", () => {
    if (audio.src) announce("Esta pista no está disponible. Prueba otra del catálogo.", true);
  });

  if ("mediaSession" in navigator) {
    const actions = { play: togglePlayback, pause: () => audio.pause(), nexttrack: () => nextTrack(), previoustrack: previousTrack, seekbackward: () => seekBy(-10), seekforward: () => seekBy(10) };
    Object.entries(actions).forEach(([action, handler]) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch {}
    });
  }

  audio.volume = lastVolume;
  els.vol.value = String(lastVolume);
  renderCards();
  renderQueue();
  syncModes();
  const savedIndex = TRACKS.findIndex((track) => track.id === saved.trackId);
  if (savedIndex >= 0) load(savedIndex, false, { restore: true });
})();
