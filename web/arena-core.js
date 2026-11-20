// Núcleo compartido de concursos: API, sesión de votante con Turnstile y renderizado de entradas con votación 1–5.
window.GrooveArena = (() => {
  const api = async (path, options = {}) => {
    const response = await fetch(path, { credentials: "same-origin", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "No se pudo completar la acción.");
      error.status = response.status;
      throw error;
    }
    return data;
  };
  const postJson = (path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  const el = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => {
      if (value === undefined || value === null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? "" : value);
    });
    children.flat().forEach((child) => child !== null && child !== undefined && node.append(child));
    return node;
  };

  const siteKey = () => document.querySelector(".cf-turnstile[data-sitekey]")?.dataset.sitekey || "";
  const whenTurnstile = () => new Promise((resolve, reject) => {
    let tries = 0;
    const check = () => {
      if (window.turnstile?.render) return resolve(window.turnstile);
      if (++tries > 100) return reject(new Error("No se pudo cargar la comprobación anti-spam."));
      setTimeout(check, 100);
    };
    check();
  });

  // Estado de la sesión de votante compartido entre todos los concursos de la página.
  let voterActive = false;
  const voterListeners = new Set();
  const setVoter = (value) => { voterActive = value; voterListeners.forEach((fn) => fn(value)); };
  api("/api/voter").then((data) => setVoter(Boolean(data.active))).catch(() => {});

  // Muestra un widget Turnstile; al superarlo crea la sesión de votante (cookie HttpOnly).
  const voterGate = () => {
    const box = el("div", { class: "voter-gate" });
    const message = el("p", { class: "arena-note", "aria-live": "polite" });
    const widget = el("div", { class: "turnstile-wrap" });
    const button = el("button", { type: "button", class: "button button-dark", text: "Activar mi voto" });
    let rendered = false;
    button.addEventListener("click", async () => {
      if (rendered) return;
      rendered = true;
      button.hidden = true;
      message.textContent = "Completa la comprobación para votar. Solo hace falta una vez por navegador.";
      try {
        const turnstile = await whenTurnstile();
        turnstile.render(widget, {
          sitekey: siteKey(),
          callback: async (token) => {
            try {
              await postJson("/api/voter", { turnstileToken: token });
              setVoter(true);
            } catch (error) {
              message.textContent = error.message;
              rendered = false;
              button.hidden = false;
              widget.replaceChildren();
            }
          }
        });
      } catch (error) {
        message.textContent = error.message;
      }
    });
    const sync = (active) => { box.hidden = active; };
    voterListeners.add(sync);
    sync(voterActive);
    box.append(el("p", { text: "Para que el voto sea justo, cada persona activa su voto una vez." }), button, widget, message);
    return box;
  };

  const phaseLabel = {
    open: "Votación abierta",
    upcoming: "Inscripciones abiertas · la votación empieza pronto",
    voting_ended: "Votación terminada · pendiente de resultados",
    closed: "Concurso cerrado"
  };
  const fmtDate = (value) => {
    if (!value) return "";
    const date = new Date(`${value.replace(" ", "T")}Z`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
  };
  const scoreText = (entry) => entry.votes ? `${entry.average.toFixed(2)} / 5 · ${entry.votes} ${entry.votes === 1 ? "valoración" : "valoraciones"}` : "Sin valoraciones todavía";

  // Renderiza un concurso completo dentro de `root`.
  const renderContest = async (root, contestId, { entryLabel } = {}) => {
    root.replaceChildren(el("p", { class: "arena-empty", text: "Cargando concurso…" }));
    let data;
    try {
      data = await api(`/api/contests/${contestId}`);
    } catch (error) {
      root.replaceChildren(el("p", { class: "arena-empty", text: error.message }));
      return;
    }
    const { contest, entries, myVotes, winners, performance, minVotesToWin } = data;
    const canVote = contest.phase === "open";
    const status = el("p", { class: "arena-note", "aria-live": "polite" });

    const head = el("div", { class: "arena-meta" },
      el("div", {},
        el("h3", { class: "contest-title", text: contest.title }),
        el("p", { text: `${phaseLabel[contest.phase] || ""} · ${fmtDate(contest.opens_at)} → ${fmtDate(contest.closes_at)}` }),
        contest.description ? el("p", { class: "contest-desc", text: contest.description }) : null
      )
    );

    const nodes = [head];
    if (canVote) nodes.push(voterGate());

    if (contest.status === "closed" && winners) {
      const overall = entries.find((entry) => entry.id === winners.overall);
      const box = el("div", { class: "arena-global" }, el("h3", { text: "Ganadora" }));
      box.append(el("p", { class: "winner-big", text: overall
        ? `🏆 ${overall.band ? overall.band.name : overall.title} — ${overall.band ? overall.title : `creada por ${overall.creator}`} (${overall.average.toFixed(2)} / 5)`
        : `Sin ganadora: ninguna entrada alcanzó ${minVotesToWin} valoraciones.` }));
      const genres = Object.entries(winners.byGenre);
      if (genres.length > 1) {
        genres.forEach(([genre, id]) => {
          const entry = entries.find((item) => item.id === id);
          if (entry) box.append(el("div", { class: "winner-row" }, el("div", {}, el("strong", { text: `${genre}: ${entry.band ? entry.band.name : entry.title}` }), el("span", { text: entry.band ? entry.title : entry.creator })), el("span", { text: scoreText(entry) })));
        });
      }
      if (contest.type === "ai_song") {
        box.append(performance
          ? el("div", { class: "performance-card" },
              el("strong", { text: performance.status === "done" ? `🎸 Tocada en directo por ${performance.band}` : `🎸 La tocará en directo: ${performance.band}` }),
              performance.event_date || performance.venue ? el("span", { text: [fmtDate(performance.event_date), performance.venue].filter(Boolean).join(" · ") }) : null,
              performance.video_url ? el("a", { href: performance.video_url, target: "_blank", rel: "noopener", text: "Ver el directo" }) : null)
          : el("p", { class: "arena-note", text: overall ? "¿Tienes banda? Ofrécete para tocarla en directo desde tu portal de banda." : "" }));
      }
      nodes.push(box);
    }

    if (!entries.length) {
      nodes.push(el("p", { class: "arena-empty", text: contest.type === "ai_song" ? "Aún no hay canciones aprobadas. ¡Envía la tuya!" : "Aún no hay bandas inscritas en este concurso." }));
      root.replaceChildren(...nodes);
      return;
    }

    const grouped = entries.reduce((acc, entry) => ((acc[entry.genre] ||= []).push(entry), acc), {});
    const grid = el("div", { class: "arena-styles" });
    Object.entries(grouped).forEach(([genre, list]) => {
      const block = el("article", { class: "arena-style" }, el("h3", { text: genre }));
      list.forEach((entry) => {
        const isWinner = winners && Object.values(winners.byGenre).includes(entry.id);
        const scoreLine = el("span", { class: "votes", text: scoreText(entry) });
        const card = el("div", { class: `arena-style-card${isWinner ? " is-winner" : ""}` },
          el("h4", { text: entry.title }),
          el("p", { class: "meta", text: entry.band ? entry.band.name : `${entryLabel || "Creada por"} ${entry.creator} · ${entry.aiTool}` }),
          entry.audioUrl ? el("audio", { controls: true, preload: "none", src: entry.audioUrl, class: "entry-audio" }) : null
        );
        if (canVote) {
          const rating = el("div", { class: "arena-rating", role: "group", "aria-label": `Valorar ${entry.title}` });
          const paint = (value) => [...rating.children].forEach((button, i) => {
            button.classList.toggle("is-active", i + 1 === value);
            button.setAttribute("aria-pressed", String(i + 1 === value));
          });
          const send = async (score) => {
            if (!voterActive) { status.textContent = "Primero activa tu voto."; return; }
            try {
              const result = await postJson(`/api/contests/${contest.id}/vote`, { entryId: entry.id, score });
              entry.votes = result.votes; entry.average = result.average;
              myVotes[entry.id] = score || undefined;
              paint(score);
              scoreLine.textContent = scoreText(entry);
              status.textContent = score ? `Has dado un ${score} a «${entry.title}».` : `Has retirado tu voto de «${entry.title}».`;
            } catch (error) {
              if (error.status === 401) setVoter(false);
              status.textContent = error.message;
            }
          };
          for (let value = 1; value <= 5; value++) rating.append(el("button", { type: "button", text: String(value), "aria-label": `${value} de 5`, onclick: () => send(value) }));
          paint(myVotes[entry.id] || 0);
          card.append(el("div", { class: "arena-vote" }, rating, el("button", { type: "button", class: "skip", text: "No votar", onclick: () => send(0) }), scoreLine));
        } else {
          card.append(scoreLine);
        }
        block.append(card);
      });
      grid.append(block);
    });
    nodes.push(grid, status);
    root.replaceChildren(...nodes);
  };

  // Selector de concursos de un tipo + concurso seleccionado.
  const mountContestList = async (root, type, { emptyText, entryLabel, onSelect } = {}) => {
    const selectWrap = el("div", { class: "contest-picker" });
    const view = el("div", { class: "contest-view" });
    root.replaceChildren(selectWrap, view);
    let contests = [];
    try {
      ({ contests } = await api(`/api/contests?type=${type}`));
    } catch (error) {
      view.replaceChildren(el("p", { class: "arena-empty", text: error.status === 503 ? "Los concursos se activarán muy pronto." : error.message }));
      return [];
    }
    if (!contests.length) {
      view.replaceChildren(el("p", { class: "arena-empty", text: emptyText || "Todavía no hay concursos." }));
      return [];
    }
    const select = el("select", { "aria-label": "Elegir concurso" },
      contests.map((contest) => el("option", { value: contest.id, text: `${contest.title}${contest.genre ? ` · ${contest.genre}` : ""} — ${phaseLabel[contest.phase] || ""}` })));
    const show = () => {
      const chosen = contests.find((contest) => String(contest.id) === select.value);
      renderContest(view, select.value, { entryLabel });
      onSelect?.(chosen);
    };
    select.addEventListener("change", show);
    selectWrap.append(el("label", { class: "contest-picker-label" }, "Concurso ", select));
    show();
    return contests;
  };

  // Mismo listado que web/functions/_shared/lib.js (GENRES). Rellena los <select data-genres>.
  const GENRES = ["Soul", "Funk", "Afrobeat", "Jazz", "Acid Jazz", "Afro Jazz", "Swing", "Reggae", "Rock", "Rock Psicodélico", "Indie Rock", "Indie Pop", "Folk", "Flamenco", "Rumba", "Fusión"];
  document.querySelectorAll("select[data-genres]").forEach((select) => {
    GENRES.forEach((genre) => select.append(el("option", { value: genre, text: genre })));
  });

  return { GENRES, api, postJson, el, renderContest, mountContestList, phaseLabel, fmtDate, whenTurnstile, siteKey };
})();
