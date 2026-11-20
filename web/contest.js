// Banda del Mes: concursos reales servidos por /api/contests (votos guardados en D1).
(() => {
  const root = document.getElementById("bandMonthRoot");
  if (!root || !window.GrooveArena) return;
  window.GrooveArena.mountContestList(root, "band_month", {
    emptyText: "La primera Banda del Mes se anunciará pronto. Registra tu banda para participar."
  });
})();
