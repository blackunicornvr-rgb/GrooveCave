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

## 5. Comprobar el despliegue

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

## Arena de Bandas (demo en frontend)

`web/contest.js` y `web/contest.css` implementan una demo local del concurso paralelo:

- valoración por estilos con escala de **1 a 5** y opción de abstención (**no votar**);
- participación restringida a **bandas inscritas** en la ronda;
- una banda ganadora por estilo (se fija al cerrar la ronda);
- final entre ganadoras por estilo y ranking global de la ronda;
- formatos de performance por entrada (tema completo, instrumental y sin voz) para facilitar trabajo en directo y de artistas emergentes.

El estado de valoraciones se guarda en `localStorage` del navegador. No hay backend ni validación de identidad; es una simulación funcional para definir experiencia y reglas de producto antes de llevarlo a APIs persistentes.

## Tema visual psicodélico suave

`web/theme-psychedelic.css` añade una capa estética inspirada en funk/psicodelia 60s–70s (acentos cálidos, toques neón, instrumentos y texturas), sin saturar la lectura. Mantiene la estructura original de la landing y evita cambios agresivos de contraste.
