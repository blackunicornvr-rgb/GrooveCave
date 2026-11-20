// Concurso de canciones hechas con IA por género: listado, votación y envío de canciones.
(() => {
  const root = document.getElementById("aiContestRoot");
  const form = document.getElementById("aiSubmitForm");
  const formWrap = document.getElementById("aiSubmitWrap");
  const formTitle = document.getElementById("aiSubmitTitle");
  const message = document.getElementById("aiSubmitMessage");
  if (!root || !form || !window.GrooveArena) return;
  const { mountContestList } = window.GrooveArena;
  let current = null;

  const syncForm = (contest) => {
    current = contest || null;
    const accepting = current && ["open", "upcoming"].includes(current.phase);
    formWrap.hidden = !accepting;
    if (accepting) formTitle.textContent = `Envía tu canción IA · ${current.genre}`;
  };

  mountContestList(root, "ai_song", {
    emptyText: "El primer concurso de canciones IA se abrirá pronto.",
    entryLabel: "Creada por",
    onSelect: syncForm
  }).then((contests) => { if (!contests.length) syncForm(null); });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!current || !form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const file = data.get("file");
    if (file && file.size > 25 * 1024 * 1024) { message.textContent = "El archivo debe pesar como máximo 25 MB."; return; }
    button.disabled = true;
    button.textContent = "Subiendo…";
    message.textContent = "";
    try {
      const response = await fetch(`/api/contests/${current.id}/ai-submit`, { method: "POST", body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "No se pudo enviar la canción.");
      form.reset();
      message.textContent = "¡Recibida! La revisaremos y, si cumple las bases, entrará en la votación.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      window.turnstile?.reset(form.querySelector(".cf-turnstile"));
      button.disabled = false;
      button.textContent = "Enviar canción";
    }
  });
})();
