(() => {
  const stylesRoot = document.getElementById("arenaStyles");
  const winnersRoot = document.getElementById("arenaWinnersList");
  const draftRoot = document.getElementById("arenaDraftBoard");
  const globalRoot = document.getElementById("arenaGlobalWinner");
  const globalBandsRoot = document.getElementById("arenaGlobalBands");
  const closeRoundBtn = document.getElementById("arenaCloseRound");
  const resetBtn = document.getElementById("arenaReset");
  if (!stylesRoot || !winnersRoot || !draftRoot || !globalRoot || !globalBandsRoot || !closeRoundBtn || !resetBtn) return;

  const TRACKS = [
    { id: "soul-1", style: "Soul", title: "Firelight", creator: "Nora Echo", usage: ["Instrumental", "Stems", "Letra"] },
    { id: "soul-2", style: "Soul", title: "Night Bloom", creator: "Lio Wave", usage: ["Instrumental", "Stems", "Guía vocal"] },
    { id: "funk-1", style: "Funk", title: "Chrome Steps", creator: "Mira Pulse", usage: ["Instrumental", "Stems"] },
    { id: "funk-2", style: "Funk", title: "Pocket Reactor", creator: "Pax Bloom", usage: ["Instrumental", "Stems", "Letra"] },
    { id: "afrobeat-1", style: "Afrobeat", title: "Urban Kora", creator: "Safi Loop", usage: ["Instrumental", "Stems", "Guía vocal"] },
    { id: "afrobeat-2", style: "Afrobeat", title: "Sunline", creator: "Dama Flux", usage: ["Instrumental", "Stems"] }
  ];
  const BANDS = ["Nebula Cueva", "Siroco Azul", "Cables Rojos", "Prisma Sur", "La Cueva Brass"];
  const STORAGE_KEY = "gc-ai-arena";

  const groupedByStyle = TRACKS.reduce((acc, track) => {
    if (!acc[track.style]) acc[track.style] = [];
    acc[track.style].push(track);
    return acc;
  }, {});

  const loadState = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        votes: parsed.votes && typeof parsed.votes === "object" ? parsed.votes : {},
        roundClosed: Boolean(parsed.roundClosed),
        assignments: parsed.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {},
        globalBands: Array.isArray(parsed.globalBands) ? parsed.globalBands : []
      };
    } catch {
      return { votes: {}, roundClosed: false, assignments: {}, globalBands: [] };
    }
  };

  let state = loadState();

  const saveState = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const getVoteCount = (trackId) => Number(state.votes[trackId] || 0);

  const pickWinnerForStyle = (tracks) => tracks
    .slice()
    .sort((a, b) => {
      const diff = getVoteCount(b.id) - getVoteCount(a.id);
      if (diff) return diff;
      return a.id.localeCompare(b.id);
    })[0];

  const getStyleWinners = () => Object.entries(groupedByStyle).map(([style, tracks]) => {
    const winner = pickWinnerForStyle(tracks);
    return { style, winner, votes: getVoteCount(winner.id) };
  });

  const getGlobalWinner = (styleWinners) => styleWinners
    .slice()
    .sort((a, b) => {
      const diff = b.votes - a.votes;
      if (diff) return diff;
      return a.winner.id.localeCompare(b.winner.id);
    })[0];

  const cleanAssignments = (styleWinners) => {
    const winnerIds = new Set(styleWinners.map((item) => item.winner.id));
    const usedBands = new Set();
    Object.entries(state.assignments).forEach(([trackId, band]) => {
      if (!winnerIds.has(trackId) || !BANDS.includes(band) || usedBands.has(band)) {
        delete state.assignments[trackId];
        return;
      }
      usedBands.add(band);
    });
  };

  const renderStyles = () => {
    stylesRoot.innerHTML = "";
    Object.entries(groupedByStyle).forEach(([style, tracks]) => {
      const block = document.createElement("article");
      block.className = "arena-style";
      block.innerHTML = `<h3>${style}</h3>`;

      tracks.forEach((track) => {
        const card = document.createElement("div");
        card.className = "arena-style-card";
        const usage = track.usage.map((item) => `<li>${item}</li>`).join("");
        card.innerHTML = `<h4>${track.title}</h4><p class="meta">${track.creator}</p><ul class="usage">${usage}</ul>`;
        const vote = document.createElement("div");
        vote.className = "arena-vote";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Votar";
        btn.disabled = state.roundClosed;
        btn.addEventListener("click", () => {
          state.votes[track.id] = getVoteCount(track.id) + 1;
          saveState();
          renderAll();
        });
        const votes = document.createElement("span");
        votes.className = "votes";
        votes.textContent = `${getVoteCount(track.id)} votos`;
        vote.append(btn, votes);
        card.append(vote);
        block.append(card);
      });
      stylesRoot.append(block);
    });
  };

  const renderWinners = (styleWinners) => {
    winnersRoot.innerHTML = "";
    styleWinners.forEach(({ style, winner, votes }) => {
      const row = document.createElement("div");
      row.className = "winner-row";
      row.innerHTML = `<div><strong>${style}: ${winner.title}</strong><span>${winner.creator}</span></div><span>${votes} votos · ${winner.usage.join(" · ")}</span>`;
      winnersRoot.append(row);
    });
  };

  const renderDraft = (styleWinners) => {
    draftRoot.innerHTML = "";
    if (!state.roundClosed) {
      draftRoot.innerHTML = "<p>Cierra la ronda para activar el draft exclusivo por banda.</p>";
      return;
    }

    const assignedBands = new Set(Object.values(state.assignments));
    styleWinners.forEach(({ style, winner }) => {
      const row = document.createElement("div");
      row.className = "draft-row";
      const assigned = state.assignments[winner.id];
      const controls = document.createElement("div");
      controls.className = "controls";

      if (!assigned) {
        const select = document.createElement("select");
        select.innerHTML = `<option value="">Elegir banda</option>${BANDS.map((band) => {
          const unavailable = assignedBands.has(band) ? "disabled" : "";
          return `<option value="${band}" ${unavailable}>${band}</option>`;
        }).join("")}`;
        const assignBtn = document.createElement("button");
        assignBtn.type = "button";
        assignBtn.textContent = "Asignar";
        assignBtn.addEventListener("click", () => {
          if (!select.value) return;
          state.assignments[winner.id] = select.value;
          saveState();
          renderAll();
        });
        controls.append(select, assignBtn);
      } else {
        const assignedText = document.createElement("span");
        assignedText.className = "assigned";
        assignedText.textContent = `Asignada a: ${assigned}`;
        const releaseBtn = document.createElement("button");
        releaseBtn.type = "button";
        releaseBtn.textContent = "Liberar";
        releaseBtn.addEventListener("click", () => {
          delete state.assignments[winner.id];
          saveState();
          renderAll();
        });
        controls.append(assignedText, releaseBtn);
      }

      row.innerHTML = `<strong>${style}: ${winner.title}</strong>`;
      row.append(controls);
      draftRoot.append(row);
    });
  };

  const renderGlobal = (globalWinner) => {
    if (!globalWinner) {
      globalRoot.textContent = "Aún no hay superganadora global.";
      globalBandsRoot.innerHTML = "";
      return;
    }
    globalRoot.textContent = `${globalWinner.winner.title} (${globalWinner.style}) de ${globalWinner.winner.creator}. Esta pista puede interpretarla cualquier banda.`;
    globalBandsRoot.innerHTML = "";
    BANDS.forEach((band) => {
      const row = document.createElement("label");
      row.className = "global-band";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.globalBands.includes(band);
      checkbox.disabled = !state.roundClosed;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.globalBands = [...new Set([...state.globalBands, band])];
        } else {
          state.globalBands = state.globalBands.filter((name) => name !== band);
        }
        saveState();
      });
      row.append(checkbox, document.createTextNode(band));
      globalBandsRoot.append(row);
    });
  };

  const renderAll = () => {
    const styleWinners = getStyleWinners();
    cleanAssignments(styleWinners);
    const globalWinner = getGlobalWinner(styleWinners);
    renderStyles();
    renderWinners(styleWinners);
    renderDraft(styleWinners);
    renderGlobal(globalWinner);
    closeRoundBtn.textContent = state.roundClosed ? "Ronda cerrada" : "Cerrar ronda y fijar ganadoras";
    closeRoundBtn.disabled = state.roundClosed;
  };

  closeRoundBtn.addEventListener("click", () => {
    state.roundClosed = true;
    saveState();
    renderAll();
  });

  resetBtn.addEventListener("click", () => {
    state = { votes: {}, roundClosed: false, assignments: {}, globalBands: [] };
    saveState();
    renderAll();
  });

  renderAll();
})();
