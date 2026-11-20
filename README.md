# GrooveCave: Cloudflare-first

Plataforma de música para **bandas emergentes con menos de 100.000 seguidores**: catálogo y reproductor, concurso mensual **Banda del Mes** y **concurso de canciones hechas con IA** por género cuya ganadora toca en directo una banda de la plataforma.

Todo funciona sobre Cloudflare: Pages (web en `web/`), Pages Functions (API en `web/functions/api/`), D1 (datos), R2 (audio) y Turnstile (anti-spam).

- `/` — web pública: catálogo, Banda del Mes, concurso IA, registro de bandas y lista de espera
- `/banda.html` — portal privado de cada banda
- `/admin.html` — panel de moderación y concursos

Lee [la guía de despliegue](web/README.md) para configurar bindings y secrets, y `npm test` para ejecutar las pruebas.
