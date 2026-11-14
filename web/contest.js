(() => {
  const stylesRoot = document.getElementById("arenaStyles");
  const winnersRoot = document.getElementById("arenaWinnersList");
  const draftRoot = document.getElementById("arenaDraftBoard");
  const globalRoot = document.getElementById("arenaGlobalWinner");
  const globalBandsRoot = document.getElementById("arenaGlobalBands");
  const closeRoundBtn = document.getElementById("arenaCloseRound");
  const resetBtn = document.getElementById("arenaReset");
  const roleSelect = document.getElementById("arenaRole");
  const visibilityNote = document.getElementById("arenaVisibilityNote");
  if (!stylesRoot || !winnersRoot || !draftRoot || !globalRoot || !globalBandsRoot || !closeRoundBtn || !resetBtn || !roleSelect || !visibilityNote) return;

  const TRACKS = [
    { id: "soul-1", style: "Soul", title: "Firelight", creator: "Nora Echo", usage: ["Instrumental", "Stems", "Letra"], seedVotes: 8, seedPoints: 33 },
    { id: "soul-2", style: "Soul", title: "Night Bloom", creator: "Lio Wave", usage: ["Instrumental", "Stems", "Guía vocal"], seedVotes: 7, seedPoints: 27 },
    { id: "funk-1", style: "Funk", title: "Chrome Steps", creator: "Mira Pulse", usage: ["Instrumental", "Stems"], seedVotes: 6, seedPoints: 22 },
    { id: "funk-2", style: "Funk", title: "Pocket Reactor", creator: "Pax Bloom", usage: ["Instrumental", "Stems", "Letra"], seedVotes: 7, seedPoints: 30 },
    { id: "afrobeat-1", style: "Afrobeat", title: "Urban Kora", creator: "Safi Loop", usage: ["Instrumental", "Stems", "Guía vocal"], seedVotes: 9, seedPoints: 36 },
    { id: "afrobeat-2", style: "Afrobeat", title: "Sunline", creator: "Dama Flux", usage: ["Instrumental", "Stems"], seedVotes: 8, seedPoints: 30 }
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
      const ratings = parsed.ratings && typeof parsed.ratings === "object" ? parsed.ratings : {};
      return {
        ratings,
        roundClosed: Boolean(parsed.roundClosed),
        assignments: parsed.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {},
        globalBands: Array.isArray(parsed.globalBands) ? parsed.globalBands : [],
        role: parsed.role === "artist" ? "artist" : "listener"
      };
    } catch {
      return { ratings: {}, roundClosed: false, assignments: {}, globalBands: [], role: "listener" };
    }
  };

  let state = loadState();
  roleSelect.value = state.role;

  const saveState = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };

  const trackScore = (track) => {
    const userRating = Number(state.ratings[track.id] || 0);
    const totalVotes = track.seedVotes + (userRating > 0 ? 1 : 0);
    const totalPoints = track.seedPoints + userRating;
    return {
      avg: totalVotes ? totalPoints / totalVotes : 0,
      votes: totalVotes,
      userRating
    };
  };

  const pickWinnerForStyle = (tracks) => tracks
    .slice()
    .sort((a, b) => {
      const scoreA = trackScore(a);
      const scoreB = trackScore(b);
      const avgDiff = scoreB.avg - scoreA.avg;
      if (Math.abs(avgDiff) > 0.0001) return avgDiff;
      const voteDiff = scoreB.votes - scoreA.votes;
      if (voteDiff) return voteDiff;
      return a.id.localeCompare(b.id);
    })[0];

  const getStyleWinners = () => Object.entries(groupedByStyle).map(([style, tracks]) => {
    const winner = pickWinnerForStyle(tracks);
    return { style, winner, score: trackScore(winner) };
  });

  const getGlobalWinner = (styleWinners) => styleWinners
    .slice()
    .sort((a, b) => {
      const diff = b.score.avg - a.score.avg;
      if (Math.abs(diff) > 0.0001) return diff;
      return b.score.votes - a.score.votes;
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
    if (state.role !== "artist") {
      stylesRoot.innerHTML = '<p class="arena-locked">La escucha y valoración de pistas de laboratorio está reservada a artistas/jurado. En modo público solo mostramos resultados y draft.</p>';
      return;
    }

    Object.entries(groupedByStyle).forEach(([style, tracks]) => {
      const block = document.createElement("article");
      block.className = "arena-style";
      block.innerHTML = `<h3>${style}</h3>`;

      tracks.forEach((track) => {
        const card = document.createElement("div");
        card.className = "arena-style-card";
        const usage = track.usage.map((item) => `<li>${item}</li>`).join("");
        const score = trackScore(track);
        card.innerHTML = `<h4>${track.title}</h4><p class="meta">${track.creator}</p><ul class="usage">${usage}</ul>`;

        const vote = document.createElement("div");
        vote.className = "arena-vote";

        const rating = document.createElement("div");
        rating.className = "arena-rating";
        for (let value = 1; value <= 5; value++) {
          const pointButton = document.createElement("button");
          pointButton.type = "button";
          pointButton.textContent = String(value);
          pointButton.classList.toggle("is-active", score.userRating === value);
          pointButton.disabled = state.roundClosed;
          pointButton.setAttribute("aria-label", `Puntuar ${track.title} con ${value} puntos`);
          pointButton.addEventListener("click", () => {
            state.ratings[track.id] = value;
            saveState();
            renderAll();
          });
          rating.append(pointButton);
        }

        const skip = document.createElement("button");
        skip.type = "button";
        skip.className = "skip";
        skip.textContent = "No votar";
        skip.disabled = state.roundClosed;
        skip.addEventListener("click", () => {
          delete state.ratings[track.id];
          saveState();
          renderAll();
        });

        const scoreText = document.createElement("span");
        scoreText.className = "votes";
        scoreText.textContent = `${score.avg.toFixed(2)} / 5 · ${score.votes} valoraciones`;

        vote.append(rating, skip, scoreText);
        card.append(vote);
        block.append(card);
      });
      stylesRoot.append(block);
    });
  };

  const renderWinners = (styleWinners) => {
    winnersRoot.innerHTML = "";
    styleWinners.forEach(({ style, winner, score }) => {
      const row = document.createElement("div");
      row.className = "winner-row";
      if (state.role === "artist") {
        row.innerHTML = `<div><strong>${style}: ${winner.title}</strong><span>${winner.creator}</span></div><span>${score.avg.toFixed(2)} / 5 · ${score.votes} valoraciones · ${winner.usage.join(" · ")}</span>`;
      } else {
        row.innerHTML = `<div><strong>${style}: ${winner.title}</strong><span>Tema seleccionado para directo</span></div><span>${score.avg.toFixed(2)} / 5 · ${score.votes} valoraciones</span>`;
      }
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
        select.disabled = state.role !== "artist";
        select.innerHTML = `<option value="">Elegir banda</option>${BANDS.map((band) => {
          const unavailable = assignedBands.has(band) ? "disabled" : "";
          return `<option value="${band}" ${unavailable}>${band}</option>`;
        }).join("")}`;
        const assignBtn = document.createElement("button");
        assignBtn.type = "button";
        assignBtn.textContent = "Asignar";
        assignBtn.disabled = state.role !== "artist";
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
        controls.append(assignedText);
        if (state.role === "artist") {
          const releaseBtn = document.createElement("button");
          releaseBtn.type = "button";
          releaseBtn.textContent = "Liberar";
          releaseBtn.addEventListener("click", () => {
            delete state.assignments[winner.id];
            saveState();
            renderAll();
          });
          controls.append(releaseBtn);
        }
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
    if (state.role === "artist") {
      globalRoot.textContent = `${globalWinner.winner.title} (${globalWinner.style}) de ${globalWinner.winner.creator}. Esta pista puede interpretarla cualquier banda.`;
    } else {
      globalRoot.textContent = `${globalWinner.winner.title} (${globalWinner.style}). Esta pista puede interpretarla cualquier banda.`;
    }

    globalBandsRoot.innerHTML = "";
    BANDS.forEach((band) => {
      const row = document.createElement("label");
      row.className = "global-band";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.globalBands.includes(band);
      checkbox.disabled = !state.roundClosed || state.role !== "artist";
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
    closeRoundBtn.disabled = state.roundClosed || state.role !== "artist";
    resetBtn.disabled = state.role !== "artist";
    visibilityNote.textContent = state.role === "artist"
      ? "Modo artista/jurado activo: puedes escuchar pistas de laboratorio y puntuar de 1 a 5 o abstenerte."
      : "Modo público activo: las pistas de laboratorio no se muestran al público. Solo se ven resultados y asignaciones.";
  };

  closeRoundBtn.addEventListener("click", () => {
    state.roundClosed = true;
    saveState();
    renderAll();
  });

  resetBtn.addEventListener("click", () => {
    state = { ratings: {}, roundClosed: false, assignments: {}, globalBands: [], role: state.role };
    saveState();
    renderAll();
  });

  roleSelect.addEventListener("change", () => {
    state.role = roleSelect.value === "artist" ? "artist" : "listener";
    saveState();
    renderAll();
  });

  renderAll();
})();
