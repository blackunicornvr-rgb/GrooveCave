document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("waitlistForm");
  const message = document.getElementById("formMessage");

  if (!form || !message) return;

  // Reemplaza estas dos constantes con los valores de tu proyecto en Supabase.
  const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
  const SUPABASE_ANON_KEY = "TU_ANON_KEY";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const formData = new FormData(form);
    const payload = {
      name: (formData.get("name") || "").toString().trim(),
      email: (formData.get("email") || "").toString().trim(),
      role: (formData.get("role") || "").toString().trim(),
      message: (formData.get("message") || "").toString().trim(),
      status: "pendiente"
    };

    if (!payload.name || !payload.email || !payload.role) {
      message.textContent = "Completa los campos obligatorios.";
      return;
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("No se pudo guardar la solicitud.");
      }

      message.textContent = "¡Gracias! Tu interés ha sido registrado correctamente.";
      form.reset();
    } catch (error) {
      console.error(error);
      message.textContent = "Ha ocurrido un error. Inténtalo de nuevo más tarde.";
    }
  });
});
