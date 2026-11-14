(() => {
  const stylesRoot = document.getElementById("arenaStyles");
  const winnersRoot = document.getElementById("arenaWinnersList");
  const finalRoot = document.getElementById("arenaDraftBoard");
  const globalRoot = document.getElementById("arenaGlobalWinner");
  const rankingRoot = document.getElementById("arenaGlobalBands");
  const closeRoundBtn = document.getElementById("arenaCloseRound");
  const resetBtn = document.getElementById("arenaReset");
  const note = document.getElementById("arenaVisibilityNote");
  if (!stylesRoot || !winnersRoot || !finalRoot || !globalRoot || !rankingRoot || !closeRoundBtn || !resetBtn || !note) return;

  const ENTRIES = [
    { id: "soul-1", style: "Soul", band: "Nebula Cueva", song: "Firelight", format: ["Tema completo", "Instrumental"] },
    { id: "soul-2", style: "Soul", band: "Siroco Azul", song: "Night Bloom", format: ["Tema completo", "Instrumental", "Sin voz"] },
    { id: "funk-1", style: "Funk", band: "Cables Rojos", song: "Chrome Steps", format: ["Tema completo", "Instrumental"] },
    { id: "funk-2", style: "Funk", band: "Prisma Sur", song: "Pocket Reactor", format: ["Tema completo", "Instrumental", "Sin voz"] },
    { id: "afro-1", style: "Afrobeat", band: "La Cueva Brass", song: "Urban Kora", format: ["Tema completo", "Instrumental"] },
    { id: "afro-2", style: "Afrobeat", band: "Nebula Cueva", song: "Sunline", format: ["Tema completo", "Sin voz"] }
  ];
  const STORAGE_KEY = "gc-band-arena";

  const byStyle = ENTRIES.reduce((acc, entry) => {
    if (!acc[entry.style]) acc[entry.style] = [];
    acc[entry.style].push(entry);
    return acc;
  }, {});

  const load = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        ratings: parsed.ratings && typeof parsed.ratings === "object" ? parsed.ratings : {},
        roundClosed: Boolean(parsed.roundClosed)
      };
    } catch {
      return { ratings: {}, roundClosed: false };
    }
  };

  let state = load();

  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const score = (entryId) => Number(state.ratings[entryId] || 0);

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

  const renderCards = () => {
    stylesRoot.innerHTML = "";
    Object.entries(byStyle).forEach(([style, entries]) => {
      const block = document.createElement("article");
      block.className = "arena-style";
      block.innerHTML = `<h3>${style}</h3>`;

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
    winners.forEach(({ style, winner }) => {
      const row = document.createElement("div");
      row.className = "draft-row";
      row.innerHTML = `<strong>${style}</strong><span class="assigned">${winner.band} · ${winner.song}</span>`;
      finalRoot.append(row);
    });
  };

  const renderGlobal = (winners) => {
    const ordered = winners
      .map(({ style, winner }) => ({ style, winner, score: avg(winner) }))
      .sort((a, b) => b.score.avg - a.score.avg);
    const champion = ordered[0];

    globalRoot.textContent = state.roundClosed
      ? `${champion.winner.band} gana la ronda con ${champion.winner.song} (${champion.style}).`
      : "Se mostrará al cerrar la ronda de votación.";

    rankingRoot.innerHTML = "";
    ordered.forEach((entry, i) => {
      const row = document.createElement("div");
      row.className = "global-band";
      row.innerHTML = `<strong>#${i + 1} ${entry.winner.band}</strong><span>${entry.score.avg.toFixed(2)} / 5</span>`;
      rankingRoot.append(row);
    });
  };

  const renderAll = () => {
    const winners = Object.entries(byStyle).map(([style, entries]) => ({ style, winner: styleWinner(entries) }));
    renderCards();
    renderWinners(winners);
    renderFinal(winners);
    renderGlobal(winners);
    closeRoundBtn.textContent = state.roundClosed ? "Ronda cerrada" : "Cerrar ronda y fijar ganadoras";
    closeRoundBtn.disabled = state.roundClosed;
    note.textContent = "Competición 100% orgánica entre bandas: puntúa de 1 a 5 o abstente. Sin IA en composición ni selección.";
  };

  closeRoundBtn.addEventListener("click", () => {
    state.roundClosed = true;
    save();
    renderAll();
  });

  resetBtn.addEventListener("click", () => {
    state = { ratings: {}, roundClosed: false };
    save();
    renderAll();
  });

  renderAll();
})();
