// Registro de bandas emergentes (< 100.000 seguidores) y directorio de bandas aprobadas.
(() => {
  const { el, api } = window.GrooveArena || {};
  if (!el) return;

  const form = document.getElementById("bandSignupForm");
  const message = document.getElementById("bandSignupMessage");
  const directory = document.getElementById("bandDirectory");
  const filter = document.getElementById("bandGenreFilter");

  const loadDirectory = async () => {
    if (!directory) return;
    try {
      const genre = filter?.value;
      const { bands } = await api(`/api/bands${genre ? `?genre=${encodeURIComponent(genre)}` : ""}`);
      if (!bands.length) {
        directory.replaceChildren(el("p", { class: "arena-empty", text: genre ? "Aún no hay bandas de este género." : "Las primeras bandas aparecerán aquí en cuanto las aprobemos." }));
        return;
      }
      directory.replaceChildren(...bands.map((band) => el("article", { class: "band-card" },
        el("h3", { text: band.name }),
        el("p", { class: "meta", text: [band.genre, band.city].filter(Boolean).join(" · ") }),
        band.bio ? el("p", { class: "band-bio", text: band.bio }) : null,
        el("p", { class: "band-followers", text: `${band.followers_count.toLocaleString("es-ES")} seguidores${band.followers_source === "spotify" ? " (verificado en Spotify)" : ""}` }),
        el("div", { class: "band-links" },
          band.spotify_url ? el("a", { href: band.spotify_url, target: "_blank", rel: "noopener", text: "Spotify" }) : null,
          band.other_url ? el("a", { href: band.other_url, target: "_blank", rel: "noopener", text: "Más música" }) : null)
      )));
    } catch (error) {
      directory.replaceChildren(el("p", { class: "arena-empty", text: error.status === 503 ? "El directorio se activará muy pronto." : error.message }));
    }
  };
  filter?.addEventListener("change", loadDirectory);
  loadDirectory();

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") || "").trim(),
      genre: String(data.get("genre") || ""),
      city: String(data.get("city") || "").trim(),
      bio: String(data.get("bio") || "").trim(),
      email: String(data.get("email") || "").trim(),
      spotifyUrl: String(data.get("spotifyUrl") || "").trim(),
      otherUrl: String(data.get("otherUrl") || "").trim(),
      followers: Number(data.get("followers")),
      consent: data.get("consent") === "on",
      turnstileToken: String(data.get("cf-turnstile-response") || ""),
      website: String(data.get("website") || "")
    };
    if (payload.followers > 100000) {
      message.textContent = "GrooveCave es solo para bandas emergentes con menos de 100.000 seguidores.";
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Enviando…";
    message.textContent = "";
    try {
      const result = await window.GrooveArena.postJson("/api/bands", payload);
      form.reset();
      message.textContent = result.verifiedWithSpotify
        ? "¡Solicitud recibida! Hemos comprobado tus seguidores en Spotify. Te escribiremos con tu clave de banda al aprobarla."
        : "¡Solicitud recibida! Revisaremos tus enlaces y te escribiremos con tu clave de banda al aprobarla.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      window.turnstile?.reset(form.querySelector(".cf-turnstile"));
      button.disabled = false;
      button.textContent = "Enviar solicitud";
    }
  });
})();
