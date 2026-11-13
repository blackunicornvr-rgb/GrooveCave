document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("waitlistForm");
  const message = document.getElementById("formMessage");
  const submitButton = form?.querySelector('button[type="submit"]');
  if (!form || !message || !submitButton) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      role: String(data.get("role") || "").trim(),
      message: String(data.get("message") || "").trim(),
      consent: data.get("consent") === "on",
      turnstileToken: String(data.get("cf-turnstile-response") || ""),
      website: String(data.get("website") || "")
    };

    message.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "Enviando…";

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "No se pudo enviar. Revisa los datos e inténtalo de nuevo.");
      }

      form.reset();
      if (window.turnstile) window.turnstile.reset();
      message.textContent = "¡Gracias! Hemos recibido tu solicitud.";
    } catch (error) {
      message.textContent = error.message || "No se pudo enviar. Inténtalo más tarde.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Apuntarme";
    }
  });
});
