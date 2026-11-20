// Portal de banda: subir canciones, inscribirse en la Banda del Mes y ofrecerse a tocar canciones IA ganadoras.
(() => {
  const { el, api, postJson, phaseLabel } = window.GrooveArena;
  const STORAGE = "gc-band-key";
  const $ = (id) => document.getElementById(id);
  let bandKey = "";
  let me = null;

  const statusPill = (status) => el("span", { class: `pill ${status}`, text: { approved: "Publicada", pending: "En revisión", rejected: "Rechazada" }[status] || status });

  const renderTracks = () => {
    const list = $("trackList");
    if (!me.tracks.length) { list.replaceChildren(el("li", { class: "arena-empty", text: "Aún no has subido canciones." })); return; }
    list.replaceChildren(...me.tracks.map((track) => el("li", { class: "portal-item" },
      el("header", {}, el("strong", { text: track.title }), statusPill(track.status)),
      el("p", { text: track.genre }))));
  };

  const renderBandMonth = async () => {
    const list = $("bandMonthList");
    const { contests } = await api("/api/contests?type=band_month&state=active");
    const usable = contests.filter((contest) => ["open", "upcoming"].includes(contest.phase));
    const published = me.tracks.filter((track) => track.status === "approved");
    if (!usable.length) { list.replaceChildren(el("li", { class: "arena-empty", text: "No hay concursos abiertos ahora mismo." })); return; }
    list.replaceChildren(...usable.map((contest) => {
      const entered = me.entries.find((entry) => entry.contest_id === contest.id);
      const item = el("li", { class: "portal-item" }, el("header", {}, el("strong", { text: contest.title }), el("span", { class: "pill", text: phaseLabel[contest.phase] })));
      if (entered) {
        const track = me.tracks.find((t) => t.id === entered.track_id);
        item.append(el("p", { text: `Inscrita con «${track?.title || "tu canción"}». ¡Suerte!` }));
        return item;
      }
      if (!published.length) { item.append(el("p", { text: "Necesitas al menos una canción publicada para inscribirte." })); return item; }
      const select = el("select", { "aria-label": "Canción para el concurso" }, published.map((track) => el("option", { value: track.id, text: `${track.title} · ${track.genre}` })));
      const msg = el("p", { "aria-live": "polite" });
      const button = el("button", { type: "button", class: "button button-small button-primary", text: "Inscribirnos", onclick: async () => {
        button.disabled = true;
        try {
          await postJson(`/api/contests/${contest.id}/enter`, { bandKey, trackId: Number(select.value) });
          await refresh();
        } catch (error) { msg.textContent = error.message; button.disabled = false; }
      } });
      item.append(el("div", { class: "portal-actions" }, select, button), msg);
      return item;
    }));
  };

  const renderAiWinners = async () => {
    const list = $("aiWinnerList");
    const { contests } = await api("/api/contests?type=ai_song&state=closed");
    const withWinner = contests.filter((contest) => contest.winner_entry_id);
    if (!withWinner.length) { list.replaceChildren(el("li", { class: "arena-empty", text: "Todavía no hay canciones IA ganadoras." })); return; }
    const items = await Promise.all(withWinner.map(async (contest) => {
      const detail = await api(`/api/contests/${contest.id}`);
      const winner = detail.entries.find((entry) => entry.id === contest.winner_entry_id);
      const item = el("li", { class: "portal-item" },
        el("header", {}, el("strong", { text: `${winner?.title || "Canción ganadora"} · ${contest.genre}` }), el("span", { class: "pill", text: contest.title })),
        winner?.audioUrl ? el("audio", { controls: true, preload: "none", src: winner.audioUrl, class: "entry-audio" }) : null);
      if (detail.performance && detail.performance.status !== "cancelled") {
        item.append(el("p", { text: `Asignada a ${detail.performance.band}.` }));
        return item;
      }
      const message = el("input", { type: "text", maxlength: "1000", placeholder: "¿Cómo la tocaríais? (opcional)", "aria-label": "Mensaje para el equipo" });
      const msg = el("p", { "aria-live": "polite" });
      const button = el("button", { type: "button", class: "button button-small button-primary", text: "Queremos tocarla", onclick: async () => {
        button.disabled = true;
        try {
          await postJson(`/api/contests/${contest.id}/perform`, { bandKey, message: message.value });
          msg.textContent = "¡Recibido! Te contactaremos si os elegimos.";
        } catch (error) { msg.textContent = error.message; button.disabled = false; }
      } });
      item.append(el("div", { class: "portal-actions" }, message, button), msg);
      return item;
    }));
    list.replaceChildren(...items);
  };

  const refresh = async () => {
    me = await postJson("/api/band-portal", { bandKey });
    $("bandName").textContent = me.band.name;
    $("bandMeta").textContent = `${me.band.genre} · ${me.band.followers.toLocaleString("es-ES")} seguidores · límite 100.000`;
    const genreSelect = document.querySelector('#trackUpload select[name="genre"]');
    if (genreSelect && !genreSelect.dataset.touched) genreSelect.value = me.band.genre;
    renderTracks();
    await Promise.all([renderBandMonth(), renderAiWinners()]).catch((error) => console.error(error));
  };

  const login = async (key) => {
    bandKey = key.trim();
    try {
      await refresh();
      sessionStorage.setItem(STORAGE, bandKey);
      $("loginPanel").hidden = true;
      $("bandArea").hidden = false;
    } catch (error) {
      sessionStorage.removeItem(STORAGE);
      $("loginMessage").textContent = error.message;
    }
  };

  $("bandLogin").addEventListener("submit", (event) => {
    event.preventDefault();
    login(new FormData(event.target).get("bandKey") || "");
  });
  $("logout").addEventListener("click", () => {
    sessionStorage.removeItem(STORAGE);
    location.reload();
  });
  document.querySelector('#trackUpload select[name="genre"]')?.addEventListener("change", (event) => { event.target.dataset.touched = "1"; });

  $("trackUpload").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    data.set("bandKey", bandKey);
    if (data.get("file")?.size > 25 * 1024 * 1024) { $("uploadMessage").textContent = "El archivo debe pesar como máximo 25 MB."; return; }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Subiendo…";
    try {
      const response = await fetch("/api/tracks", { method: "POST", body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo subir la canción.");
      form.reset();
      $("uploadMessage").textContent = "¡Subida! La revisaremos antes de publicarla.";
      await refresh();
    } catch (error) {
      $("uploadMessage").textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = "Subir canción";
    }
  });

  const saved = sessionStorage.getItem(STORAGE);
  if (saved) login(saved);
})();
