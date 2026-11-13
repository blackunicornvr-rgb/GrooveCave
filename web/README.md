# Landing de GrooveCave

La landing es una página estática pensada para desplegarse con Cloudflare Pages.

## Archivos

- `index.html`: contenido de la página.
- `styles.css`: estilos adaptables a móvil y escritorio.
- `script.js`: comportamiento del formulario de demostración.

## Probar localmente

Abre `index.html` en un navegador o sirve la carpeta con cualquier servidor estático local.

## Desplegar con Cloudflare Pages

Al conectar este repositorio en Cloudflare Pages, configura:

- Rama de producción: `main`
- Directorio raíz: `web`
- Comando de compilación: vacío (sitio HTML estático)
- Directorio de salida: `.`

El formulario es solamente visual y **no guarda ni envía datos**. No recopiles solicitudes reales hasta conectarlo a un servicio de backend y publicar la información de privacidad correspondiente.
