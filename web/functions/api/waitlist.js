export async function onRequestPost({ request, env }) {
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });

  if (!env.GROOVECAVE_DB) return json({ error: "El formulario no está configurado todavía." }, 503);

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return json({ error: "Solicitud no válida." }, 415);

  let data;
  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 12_000) return json({ error: "La solicitud es demasiado grande." }, 413);
    data = await request.json();
  } catch {
    return json({ error: "No se pudo leer el formulario." }, 400);
  }

  // Honeypot: accept silently but do not store automated submissions.
  if (typeof data.website === "string" && data.website.trim()) return json({ ok: true });

  const name = typeof data.name === "string" ? data.name.trim() : "";
  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const role = typeof data.role === "string" ? data.role : "";
  const message = typeof data.message === "string" ? data.message.trim() : "";
  const allowedRoles = new Set(["artista", "oyente", "promotor"]);

  if (name.length < 1 || name.length > 100) return json({ error: "Revisa el nombre (máximo 100 caracteres)." }, 400);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Introduce un email válido." }, 400);
  if (!allowedRoles.has(role)) return json({ error: "Selecciona una opción válida." }, 400);
  if (message.length > 2000) return json({ error: "El mensaje no puede superar 2000 caracteres." }, 400);
  if (data.consent !== true) return json({ error: "Debes aceptar la información de privacidad." }, 400);

  // Verify Turnstile on the server. Keep the secret in a Pages secret, never in frontend code.
  if (!env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_SITE_KEY) {
    return json({ error: "La protección anti-spam no está configurada todavía." }, 503);
  }
  const token = typeof data.turnstileToken === "string" ? data.turnstileToken : "";
  if (!token || token.length > 2048) return json({ error: "Completa la comprobación anti-spam." }, 400);

  const formData = new FormData();
  formData.append("secret", env.TURNSTILE_SECRET_KEY);
  formData.append("response", token);
  const remoteIp = request.headers.get("CF-Connecting-IP");
  if (remoteIp) formData.append("remoteip", remoteIp);

  let verification;
  try {
    const verifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData
    });
    verification = await verifyResponse.json();
  } catch {
    return json({ error: "No se pudo verificar el formulario. Inténtalo de nuevo." }, 502);
  }
  if (!verification.success || verification.hostname !== new URL(request.url).hostname) {
    return json({ error: "La comprobación anti-spam no se ha completado. Inténtalo de nuevo." }, 400);
  }

  try {
    await env.GROOVECAVE_DB.prepare(
      "INSERT INTO waitlist (name, email, role, message, consent, created_at) VALUES (?, ?, ?, ?, 1, datetime('now'))"
    ).bind(name, email, role, message || null).run();
    return json({ ok: true }, 201);
  } catch (error) {
    // Do not expose database details or disclose whether an email is already registered.
    if (String(error).includes("UNIQUE constraint failed")) return json({ ok: true });
    console.error("waitlist insert failed", error);
    return json({ error: "No se pudo guardar la solicitud. Inténtalo más tarde." }, 500);
  }
}
