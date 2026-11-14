(() => {
  const stylesRoot = document.getElementById("arenaStyles");
  const winnersRoot = document.getElementById("arenaWinnersList");
  const finalRoot = document.getElementById("arenaDraftBoard");
  const globalRoot = document.getElementById("arenaGlobalWinner");
  const rankingRoot = document.getElementById("arenaGlobalBands");
  const closeRoundBtn = document.getElementById("arenaCloseRound");
  const resetBtn = document.getElementById("arenaReset");
  const note = document.getElementById("arenaVisibilityNote");
  const bandSelect = document.getElementById("arenaBandSelect");
  const enrollBtn = document.getElementById("arenaEnrollBtn");
  const enrollmentList = document.getElementById("arenaEnrollmentList");
  if (!stylesRoot || !winnersRoot || !finalRoot || !globalRoot || !rankingRoot || !closeRoundBtn || !resetBtn || !note || !bandSelect || !enrollBtn || !enrollmentList) return;

  const ENTRIES = [
    { id: "soul-1", style: "Soul", band: "Nebula Cueva", song: "Firelight", format: ["Tema completo", "Instrumental"] },
    { id: "soul-2", style: "Soul", band: "Siroco Azul", song: "Night Bloom", format: ["Tema completo", "Instrumental", "Sin voz"] },
    { id: "funk-1", style: "Funk", band: "Cables Rojos", song: "Chrome Steps", format: ["Tema completo", "Instrumental"] },
    { id: "funk-2", style: "Funk", band: "Prisma Sur", song: "Pocket Reactor", format: ["Tema completo", "Instrumental", "Sin voz"] },
    { id: "afro-1", style: "Afrobeat", band: "La Cueva Brass", song: "Urban Kora", format: ["Tema completo", "Instrumental"] },
    { id: "afro-2", style: "Afrobeat", band: "Nebula Cueva", song: "Sunline", format: ["Tema completo", "Sin voz"] }
  ];
  const STORAGE_KEY = "gc-band-arena";
  const STYLES = [...new Set(ENTRIES.map((entry) => entry.style))];
  const BANDS = [...new Set(ENTRIES.map((entry) => entry.band))].sort();

  const load = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        ratings: parsed.ratings && typeof parsed.ratings === "object" ? parsed.ratings : {},
        roundClosed: Boolean(parsed.roundClosed),
        enrolledBands: Array.isArray(parsed.enrolledBands) ? parsed.enrolledBands.filter((band) => BANDS.includes(band)) : []
      };
    } catch {
      return { ratings: {}, roundClosed: false, enrolledBands: [] };
    }
  };

  let state = load();

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const score = (entryId) => Number(state.ratings[entryId] || 0);
  const isEnrolled = (band) => state.enrolledBands.includes(band);

  const activeEntries = () => ENTRIES.filter((entry) => isEnrolled(entry.band));
  const entriesByStyle = () => STYLES.reduce((acc, style) => {
    acc[style] = activeEntries().filter((entry) => entry.style === style);
    return acc;
  }, {});

  const pruneRatings = () => {
    const validIds = new Set(activeEntries().map((entry) => entry.id));
    Object.keys(state.ratings).forEach((entryId) => {
      if (!validIds.has(entryId)) delete state.ratings[entryId];
    });
  };

  const avg = (entry) => {
    const seedVotes = 6;
    const seedPoints = 23;
    const userVote = score(entry.id);
    const votes = seedVotes + (userVote > 0 ? 1 : 0);
    const points = seedPoints + userVote;
    return { avg: points / votes, votes };
  };

  const styleWinner = (entries) => entries.slice().sort((a, b) => {
    const aScore = avg(a);
    const bScore = avg(b);
    const diff = bScore.avg - aScore.avg;
    if (Math.abs(diff) > 0.0001) return diff;
    return bScore.votes - aScore.votes;
  })[0];

  const renderEnrollment = () => {
    const availableBands = BANDS.filter((band) => !isEnrolled(band));
    bandSelect.innerHTML = `<option value="">Seleccionar banda</option>${availableBands.map((band) => `<option value="${band}">${band}</option>`).join("")}`;
    bandSelect.disabled = state.roundClosed || availableBands.length === 0;
    enrollBtn.disabled = state.roundClosed || availableBands.length === 0;

    enrollmentList.innerHTML = "";
    if (!state.enrolledBands.length) {
      enrollmentList.innerHTML = '<p class="arena-empty">Aún no hay bandas inscritas. Solo participan bandas apuntadas.</p>';
      return;
    }

    state.enrolledBands.forEach((band) => {
      const chip = document.createElement("div");
      chip.className = "enrolled-band";
      chip.innerHTML = `<span>${band}</span>`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.disabled = state.roundClosed;
      remove.setAttribute("aria-label", `Quitar ${band} de la competición`);
      remove.addEventListener("click", () => {
        state.enrolledBands = state.enrolledBands.filter((name) => name !== band);
        pruneRatings();
        save();
        renderAll();
      });
      chip.append(remove);
      enrollmentList.append(chip);
    });
  };

  const renderCards = (grouped) => {
    stylesRoot.innerHTML = "";
    STYLES.forEach((style) => {
      const entries = grouped[style];
      const block = document.createElement("article");
      block.className = "arena-style";
      block.innerHTML = `<h3>${style}</h3>`;

      if (!entries.length) {
        const empty = document.createElement("p");
        empty.className = "arena-empty";
        empty.textContent = "Sin bandas inscritas en este estilo.";
        block.append(empty);
        stylesRoot.append(block);
        return;
      }

      entries.forEach((entry) => {
        const card = document.createElement("div");
        card.className = "arena-style-card";
        const scoreInfo = avg(entry);
        card.innerHTML = `<h4>${entry.song}</h4><p class="meta">${entry.band}</p><ul class="usage">${entry.format.map((x) => `<li>${x}</li>`).join("")}</ul>`;

        const vote = document.createElement("div");
        vote.className = "arena-vote";
        const stars = document.createElement("div");
        stars.className = "arena-rating";

        for (let value = 1; value <= 5; value++) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = String(value);
          btn.classList.toggle("is-active", score(entry.id) === value);
          btn.disabled = state.roundClosed;
          btn.addEventListener("click", () => {
            state.ratings[entry.id] = value;
            save();
            renderAll();
          });
          stars.append(btn);
        }

        const abstain = document.createElement("button");
        abstain.type = "button";
        abstain.className = "skip";
        abstain.textContent = "No votar";
        abstain.disabled = state.roundClosed;
        abstain.addEventListener("click", () => {
          delete state.ratings[entry.id];
          save();
          renderAll();
        });

        const points = document.createElement("span");
        points.className = "votes";
        points.textContent = `${scoreInfo.avg.toFixed(2)} / 5 · ${scoreInfo.votes} valoraciones`;

        vote.append(stars, abstain, points);
        card.append(vote);
        block.append(card);
      });

      stylesRoot.append(block);
    });
  };

  const renderWinners = (winners) => {
    winnersRoot.innerHTML = "";
    if (!winners.length) {
      winnersRoot.innerHTML = '<p class="arena-empty">No hay ganadoras porque no hay bandas inscritas.</p>';
      return;
    }
    winners.forEach(({ style, winner }) => {
      const winnerScore = avg(winner);
      const row = document.createElement("div");
      row.className = "winner-row";
      row.innerHTML = `<div><strong>${style}: ${winner.band}</strong><span>${winner.song}</span></div><span>${winnerScore.avg.toFixed(2)} / 5 · ${winnerScore.votes} valoraciones</span>`;
      winnersRoot.append(row);
    });
  };

  const renderFinal = (winners) => {
    finalRoot.innerHTML = "";
    if (!state.roundClosed) {
      finalRoot.innerHTML = "<p>Cierra la ronda para confirmar qué banda pasa a la final por cada estilo.</p>";
      return;
    }
    if (!winners.length) {
      finalRoot.innerHTML = "<p>Sin bandas inscritas no hay final de ronda.</p>";
      return;
    }
    winners.forEach(({ style, winner }) => {
      const row = document.createElement("div");
      row.className = "draft-row";
      row.innerHTML = `<strong>${style}</strong><span class="assigned">${winner.band} · ${winner.song}</span>`;
      finalRoot.append(row);
    });
  };

  const renderGlobal = (winners) => {
    rankingRoot.innerHTML = "";
    if (!winners.length) {
      globalRoot.textContent = "Inscribe bandas para generar ranking y ganadora global.";
      return;
    }
    const ordered = winners
      .map(({ style, winner }) => ({ style, winner, score: avg(winner) }))
      .sort((a, b) => b.score.avg - a.score.avg);
    const champion = ordered[0];

    globalRoot.textContent = state.roundClosed
      ? `${champion.winner.band} gana la ronda con ${champion.winner.song} (${champion.style}).`
      : "Se mostrará al cerrar la ronda de votación.";

    ordered.forEach((entry, i) => {
      const row = document.createElement("div");
      row.className = "global-band";
      row.innerHTML = `<strong>#${i + 1} ${entry.winner.band}</strong><span>${entry.score.avg.toFixed(2)} / 5</span>`;
      rankingRoot.append(row);
    });
  };

  const renderAll = () => {
    const grouped = entriesByStyle();
    const winners = STYLES
      .map((style) => ({ style, winner: grouped[style].length ? styleWinner(grouped[style]) : null }))
      .filter((item) => item.winner);

    renderEnrollment();
    renderCards(grouped);
    renderWinners(winners);
    renderFinal(winners);
    renderGlobal(winners);

    closeRoundBtn.textContent = state.roundClosed ? "Ronda cerrada" : "Cerrar ronda y fijar ganadoras";
    closeRoundBtn.disabled = state.roundClosed || winners.length === 0;
    note.textContent = "Competición 100% orgánica entre bandas: puntúa de 1 a 5 o abstente. Solo participan bandas inscritas.";
  };

  enrollBtn.addEventListener("click", () => {
    if (!bandSelect.value || state.roundClosed) return;
    if (!isEnrolled(bandSelect.value)) {
      state.enrolledBands = [...state.enrolledBands, bandSelect.value];
      save();
      renderAll();
    }
  });

  closeRoundBtn.addEventListener("click", () => {
    state.roundClosed = true;
    save();
    renderAll();
  });

  resetBtn.addEventListener("click", () => {
    state = { ratings: {}, roundClosed: false, enrolledBands: [] };
    save();
    renderAll();
  });

  renderAll();
})();
