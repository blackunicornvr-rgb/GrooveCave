// Panel de administración de GrooveCave. Todas las llamadas usan el token en la cabecera Authorization.
(() => {
  const { el, fmtDate } = window.GrooveArena;
  const STORAGE = "gc-admin-token";
  const $ = (id) => document.getElementById(id);
  let token = "";

  const request = async (method, path, body) => {
    const response = await fetch(`/api/admin/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(data.error || "Error"); error.status = response.status; throw error; }
    return data;
  };
  const toUtc = (value) => (value ? new Date(value).toISOString().slice(0, 16) : null);
  const say = (text) => { $("adminMessage").textContent = text; };
  const act = (method, path, body, done = "Hecho.") => async () => {
    try {
      const result = await request(method, path, body);
      say(result.reason ? `${done} ${result.reason}` : done);
      if (result.bandKey) {
        $("newKey").hidden = false;
        $("newKeyFor").textContent = `Para: ${result.contactEmail}`;
        $("newKeyValue").textContent = result.bandKey;
        $("newKey").scrollIntoView({ behavior: "smooth" });
      }
      await load();
    } catch (error) { say(error.message); }
  };

  // El audio pendiente solo se sirve con el token, así que se descarga como blob para escucharlo.
  const preview = (url) => {
    const audio = el("audio", { controls: true, class: "entry-audio" });
    const button = el("button", { type: "button", class: "button button-small button-dark", text: "▶ Escuchar", onclick: async () => {
      button.disabled = true;
      try {
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("No se pudo cargar el audio.");
        audio.src = URL.createObjectURL(await response.blob());
        button.replaceWith(audio);
        audio.play().catch(() => {});
      } catch (error) { say(error.message); button.disabled = false; }
    } });
    return button;
  };
  const reviewButtons = (path, extra = {}) => el("div", { class: "portal-actions" },
    el("button", { type: "button", class: "button button-small button-primary", text: "Aprobar", onclick: () => act("POST", path, { action: "approve", ...extra() }, "Aprobado.")() }),
    el("button", { type: "button", class: "button button-small button-dark", text: "Rechazar", onclick: act("POST", path, { action: "reject" }, "Rechazado.") }));
  const empty = (text) => el("li", { class: "arena-empty", text });

  const renderPending = (data) => {
    $("pendingBands").replaceChildren(...(data.bands.length ? data.bands.map((band) => {
      const followers = el("input", { type: "number", min: "0", value: band.followers_count, "aria-label": "Seguidores comprobados" });
      return el("li", { class: "portal-item" },
        el("header", {}, el("strong", { text: `${band.name} · ${band.genre}` }), el("span", { class: "pill pending", text: `${band.followers_count.toLocaleString("es-ES")} seguidores (${band.followers_source})` })),
        el("p", { text: [band.city, band.contact_email, fmtDate(band.created_at)].filter(Boolean).join(" · ") }),
        band.bio ? el("p", { text: band.bio }) : null,
        el("p", {}, band.spotify_url ? el("a", { href: band.spotify_url, target: "_blank", rel: "noopener", class: "inline-link", text: "Spotify" }) : null, " ", band.other_url ? el("a", { href: band.other_url, target: "_blank", rel: "noopener", class: "inline-link", text: "Otro enlace" }) : null),
        el("label", { class: "portal-actions" }, "Seguidores comprobados: ", followers),
        reviewButtons(`bands/${band.id}`, () => ({ followers: followers.value })));
    }) : [empty("No hay bandas pendientes.")]));

    $("pendingTracks").replaceChildren(...(data.tracks.length ? data.tracks.map((track) => el("li", { class: "portal-item" },
      el("header", {}, el("strong", { text: `${track.title} — ${track.band}` }), el("span", { class: "pill", text: track.genre })),
      preview(track.audioUrl), reviewButtons(`tracks/${track.id}`, () => ({})))) : [empty("No hay canciones pendientes.")]));

    $("pendingAi").replaceChildren(...(data.aiSongs.length ? data.aiSongs.map((song) => el("li", { class: "portal-item" },
      el("header", {}, el("strong", { text: `${song.title} — ${song.creator_name}` }), el("span", { class: "pill", text: `${song.contest} · ${song.genre}` })),
      el("p", { text: `${song.ai_tool} · ${song.creator_email}` }), song.notes ? el("p", { text: song.notes }) : null,
      preview(song.audioUrl), reviewButtons(`ai-songs/${song.id}`, () => ({})))) : [empty("No hay canciones IA pendientes.")]));

    $("applications").replaceChildren(...(data.applications.length ? data.applications.map((app) => {
      const date = el("input", { type: "datetime-local", "aria-label": "Fecha del directo" });
      const venue = el("input", { type: "text", maxlength: "160", placeholder: "Sala y ciudad", "aria-label": "Lugar" });
      return el("li", { class: "portal-item" },
        el("header", {}, el("strong", { text: `${app.band} (${app.genre})` }), el("span", { class: "pill", text: app.contest })),
        app.message ? el("p", { text: app.message }) : null,
        el("div", { class: "portal-actions" }, date, venue,
          el("button", { type: "button", class: "button button-small button-primary", text: "Asignar directo", onclick: () => act("POST", `contests/${app.contest_id}/performance`, { bandId: app.band_id, eventDate: toUtc(date.value), venue: venue.value }, "Banda asignada.")() })));
    }) : [empty("No hay solicitudes.")]));
  };

  const renderContests = ({ contests }) => {
    $("contestList").replaceChildren(...(contests.length ? contests.map((contest) => el("li", { class: "portal-item" },
      el("header", {}, el("strong", { text: `${contest.title}${contest.genre ? ` · ${contest.genre}` : ""}` }), el("span", { class: `pill ${contest.status === "closed" ? "approved" : "pending"}`, text: contest.status === "closed" ? "Cerrado" : "Abierto" })),
      el("p", { text: `${contest.type === "ai_song" ? "Canción IA" : "Banda del Mes"} · ${contest.entries} entradas · ${fmtDate(contest.opens_at)} → ${fmtDate(contest.closes_at)}` }),
      contest.status !== "closed" ? el("div", { class: "portal-actions" }, el("button", { type: "button", class: "button button-small button-primary", text: "Cerrar y calcular ganadoras", onclick: () => {
        if (confirm(`¿Cerrar «${contest.title}»? No se podrá reabrir.`)) act("POST", `contests/${contest.id}/close`, undefined, "Concurso cerrado.")();
      } })) : null)) : [empty("Aún no hay concursos.")]));
  };

  const renderWaitlist = ({ waitlist }) => {
    $("waitlist").replaceChildren(...(waitlist.length ? waitlist.map((row) => el("li", { class: "portal-item" },
      el("header", {}, el("strong", { text: `${row.name} · ${row.email}` }), el("span", { class: "pill", text: row.role })),
      row.message ? el("p", { text: row.message }) : null, el("p", { text: fmtDate(row.created_at) }))) : [empty("Sin solicitudes todavía.")]));
  };

  const load = async () => {
    const [pending, contests, waitlist] = await Promise.all([request("GET", "pending"), request("GET", "contests"), request("GET", "waitlist")]);
    renderPending(pending);
    renderContests(contests);
    renderWaitlist(waitlist);
  };

  const login = async (value) => {
    token = value.trim();
    try {
      await load();
      sessionStorage.setItem(STORAGE, token);
      $("adminLogin").hidden = true;
      $("adminArea").hidden = false;
      $("adminLogout").hidden = false;
    } catch (error) {
      sessionStorage.removeItem(STORAGE);
      $("adminLoginMessage").textContent = error.message;
    }
  };

  $("adminLoginForm").addEventListener("submit", (event) => { event.preventDefault(); login(new FormData(event.target).get("token") || ""); });
  $("adminLogout").addEventListener("click", () => { sessionStorage.removeItem(STORAGE); location.reload(); });
  $("contestForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    data.opensAt = toUtc(data.opensAt);
    data.closesAt = toUtc(data.closesAt);
    await act("POST", "contests", data, "Concurso creado.")();
    event.target.reset();
  });

  const saved = sessionStorage.getItem(STORAGE);
  if (saved) login(saved);
})();
