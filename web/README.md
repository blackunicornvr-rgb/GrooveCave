# Despliegue de GrooveCave en Cloudflare Pages

La landing y el endpoint de lista de espera usan Cloudflare Pages Functions + D1 + Turnstile. Supabase ya no forma parte del flujo del formulario.

## 1. Crear la base D1

En Cloudflare Dashboard: **Workers & Pages → D1 SQL Database → Create database**. Elige un nombre, por ejemplo `groovecave-waitlist`.

Abre la base en el panel SQL y ejecuta el contenido de `db/schema.sql`.

## 2. Vincular D1 a Pages

Abre tu proyecto de Pages → **Settings → Functions → D1 database bindings**. Añade un binding:

- Variable name: `GROOVECAVE_DB`
- D1 database: la base que acabas de crear

Guarda y vuelve a desplegar el proyecto.

## 3. Configurar Turnstile

En **Cloudflare Dashboard → Turnstile**, crea un widget para el dominio de la web. Añade a las variables de entorno de Pages (Production y Preview):

- `TURNSTILE_SITE_KEY`: la clave del sitio (variable pública)
- `TURNSTILE_SECRET_KEY`: la clave secreta (configúrala como secret; no la añadas al repositorio)

En `web/index.html`, sustituye `TU_TURNSTILE_SITE_KEY` por la site key. No publiques nunca la secret key.

## 4. Ajustes de Pages

Con el repositorio conectado:

- Rama de producción: `main`
- Directorio raíz: `web`
- Comando de compilación: vacío
- Directorio de salida: `.`

Pages detecta las funciones en `web/functions/` con esta raíz. La ruta del endpoint es `POST /api/waitlist`.

## 5. Plataforma: audio, administración y votaciones

Además de lo anterior, la plataforma completa necesita:

**Binding R2** (Settings → Functions → R2 bucket bindings):

- Variable name: `AUDIO_BUCKET` (también se acepta `GROOVECAVE_AUDIO`)
- Bucket: `groovecave-audio` (ya creado)

**Secrets** (Settings → Variables and Secrets, tipo *Secret*, en Production y Preview):

- `ADMIN_TOKEN`: token largo y aleatorio (mín. 24 caracteres) para entrar en `/admin.html`.
- `VOTE_SECRET`: otro valor largo y aleatorio para firmar las cookies de votación.
- `SPOTIFY_CLIENT_ID` y `SPOTIFY_CLIENT_SECRET` (opcionales): credenciales de una app de developer.spotify.com. Si existen, el registro comprueba automáticamente los seguidores del perfil de Spotify y rechaza bandas con más de 100.000. Sin ellas, el límite se valida con el dato declarado y la revisión manual.

Puedes generar valores aleatorios con `openssl rand -hex 32`.

**Base de datos:** ejecuta `db/migrations/0002_plataforma.sql` en la consola de D1 (es aditiva; `db/schema.sql` contiene el esquema completo para bases nuevas).

## 6. Comprobar el despliegue

Después del deploy, prueba el formulario con datos de prueba y revisa **D1 → Console** para confirmar que se añadió una fila. No se ofrece endpoint público de lectura; consulta las solicitudes desde el panel autenticado de D1.

## Seguridad y privacidad

- El navegador no recibe una clave de base de datos: las escrituras las realiza la Pages Function.
- Turnstile se verifica en servidor y el campo trampa descarta bots simples.
- Antes de recoger datos reales, publica un aviso de privacidad que identifique responsable, finalidad, retención, derechos y contacto, adecuado a tu jurisdicción.
- No guardes información sensible en el campo libre. Define un plazo para borrar solicitudes antiguas.
- Considera configurar reglas de rate limiting para `POST /api/waitlist` si recibes abuso.

Si antes habías creado una tabla de prueba en Supabase, este flujo no la utiliza.

## Reproductor de demostración

El catálogo del reproductor vive en `web/player.js`. Las pistas actuales son tonos sintetizados localmente para probar controles e interacción; no son música publicada ni contenido de artistas. Para usar audio autorizado, añade a cada pista una URL `src` y sus metadatos editoriales y sustituye los datos de ejemplo. Antes de abrir un catálogo real, implementa almacenamiento/CDN, derechos de acceso, derechos musicales y telemetría de escucha en el backend; no expongas enlaces privados o credenciales en el navegador.

El reproductor incluye búsqueda, favoritos locales, cola, aleatorio, repetición (desactivada/cola/pista), volumen y silencio, recuperación de la posición, controles multimedia compatibles, atajos de teclado y una vista ampliada accesible. Las preferencias se guardan solo en el almacenamiento local del navegador. Los atajos globales no interfieren con campos de formulario ni controles enfocables.

## Tema visual psicodélico suave

`web/theme-psychedelic.css` añade una capa estética inspirada en funk/psicodelia 60s–70s (acentos cálidos, toques neón, instrumentos y texturas), sin saturar la lectura. Mantiene la estructura original de la landing y evita cambios agresivos de contraste.

Los fondos difuminados usan ilustraciones SVG originales en `web/assets/`, sin dependencias externas. Se aplican con baja opacidad en el hero, catálogo, comunidad, arena y formulario para mantener el texto legible.

## Cómo funciona la plataforma

1. **Registro de bandas** (`#bandas`): solo bandas con menos de 100.000 seguidores. Quedan pendientes hasta que se aprueban en `/admin.html`.
2. **Clave de banda:** al aprobar, el panel muestra una clave privada (`gc_…`) una sola vez. Envíasela a la banda; en la base solo se guarda su hash.
3. **Portal de banda** (`/banda.html`): con su clave la banda sube canciones (máx. 25 MB, revisadas antes de publicarse), se inscribe en la Banda del Mes y se ofrece para tocar canciones IA ganadoras.
4. **Banda del Mes:** se crea el concurso en el panel; las bandas se inscriben con una canción publicada; la comunidad puntúa de 1 a 5. Al cerrarlo, gana la mejor media por género y la mejor absoluta (mínimo 3 valoraciones).
5. **Concurso de canciones IA:** un concurso por género. Cualquiera envía su canción IA; tras aprobarla entra en votación. Al cerrar, las bandas se ofrecen desde su portal y en el panel se asigna la banda, fecha y sala del directo, que aparece publicado en la web.
6. **Votos:** cada navegador activa su voto una vez con Turnstile y recibe una cookie firmada (HttpOnly). Máximo 3 sesiones nuevas por conexión al día y límite de peticiones. Es una protección razonable para un MVP, no un sistema de identidad: para premios con valor económico conviene añadir verificación por email o cuentas.

El audio solo se sirve si está aprobado (`/api/audio/…`, con soporte de avance por rangos); el panel de administración puede escuchar lo pendiente con su token.

## Desarrollo local y pruebas

Requiere Node 22.5 o superior (usa `node:sqlite`, sin dependencias):

```bash
npm test                              # pruebas de la API
node tests/dev-server.mjs --seed      # web + API en http://localhost:8788 con datos de ejemplo
```

El servidor local simula D1, R2, Turnstile y Spotify. El token de admin local se muestra al arrancar.
