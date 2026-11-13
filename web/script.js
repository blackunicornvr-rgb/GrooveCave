document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("waitlistForm");
  const message = document.getElementById("formMessage");
  if (!form || !message) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    message.textContent = "La página está en modo de prueba: tus datos no se han enviado ni guardado.";
  });
});
