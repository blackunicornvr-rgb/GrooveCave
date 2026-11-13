document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("waitlistForm");
  const message = document.getElementById("formMessage");

  if (!form || !message) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const name = (formData.get("name") || "").toString().trim();
    const role = (formData.get("role") || "").toString().trim();

    if (!name || !role) {
      message.textContent = "Completa los campos obligatorios antes de continuar.";
      return;
    }

    message.textContent = "¡Gracias! Tu interés ha sido registrado. Te avisaremos pronto.";
    form.reset();
  });
});

