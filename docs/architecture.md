# Arquitectura técnica propuesta

## Estado de esta propuesta

Este documento describe una arquitectura inicial para validar GrooveCave, no servicios ya configurados. Conviene evitar compromisos de infraestructura hasta confirmar el flujo del producto, los derechos musicales y los requisitos de privacidad y costes.

## Primera versión: landing y lista de interés

```text
Navegador
   │
   ▼
Web estática / aplicación web en Cloudflare Pages
   │ formulario validado en servidor
   ▼
Supabase (base de datos con acceso mínimo necesario)
```

La primera entrega puede limitarse a contenido público y un formulario. No necesita microservicios, aplicación móvil ni una API independiente. Se debe minimizar la información personal recogida, validar entradas en servidor, proteger secretos en variables de entorno y definir cómo borrar los datos recibidos.

## Evolución del producto

### Web

Una aplicación web adaptable es suficiente para validar landing, perfiles y catálogo. Cloudflare Pages es una opción candidata si el framework elegido y sus funciones de servidor encajan con el despliegue. Mantener el sitio accesible, rápido y usable en móvil.

### Datos y autenticación

Supabase/PostgreSQL puede gestionar perfiles, catálogo y autenticación. Diseñar políticas de acceso desde el inicio: permisos por rol, Row Level Security en tablas expuestas, privilegio mínimo y pruebas de acceso anónimo/usuario/artista/administrador. No confiar solo en ocultar controles en la interfaz.

Entidades posibles, a definir cuando se concrete el producto:

- `profiles` y `artist_profiles`
- `releases` y `tracks` (metadatos y estado de publicación)
- `genres` o etiquetas editoriales
- `events` y `venues`
- `votes` (con restricciones contra duplicados y auditoría)
- `consents` o registros de solicitudes, con retención limitada

No crear tablas de pagos o suscripciones antes de elegir proveedor y definir obligaciones legales y contables.

### Audio

Cloudflare R2 es una opción candidata de almacenamiento, pero la entrega de audio requiere validar formatos, transcodificación, reproducción, ancho de banda real, caché, copias, protección contra enlaces compartidos y costes. Antes de aceptar archivos, definir quién tiene derechos y obtener autorización documentada para almacenar y distribuir cada grabación. No tratar R2 como un sistema de gestión de derechos ni asumir que el almacenamiento resuelve las obligaciones de streaming.

Para el prototipo, considerar enlaces de reproducción autorizados o un catálogo editorial sin subir audio. Si se implementa carga, usar cargas controladas, límites de tamaño y tipo, cuarentena/revisión y acceso restringido a archivos no publicados.

## Seguridad, privacidad y operación

- Separar secretos del código; nunca exponer claves de servicio en el navegador.
- Aplicar validación de servidor, límites de solicitudes y protección contra spam.
- Limitar acceso de moderación y administración; registrar acciones relevantes.
- Añadir políticas de privacidad, consentimiento, retención y eliminación antes de recoger datos personales.
- No lanzar votaciones hasta diseñar reglas de elegibilidad, prevención de abuso, auditoría y mecanismo de impugnación.
- Usar HTTPS, dependencias actualizadas, copias de seguridad y un procedimiento de respuesta a incidentes.
- Configurar CI para lint, pruebas y compilación antes del despliegue público.

## Decisiones pendientes

1. Framework web y estrategia de renderizado.
2. Si el primer catálogo usa enlaces o audio alojado.
3. Jurisdicción, privacidad, derechos de autor y términos para artistas.
4. Costes de almacenamiento, entrega y moderación a escala piloto.
5. Definición editorial y proceso de apelación.

## Recomendación

Empieza con una landing y una lista de interés. Añade Supabase solo cuando sea necesario para guardar solicitudes de forma segura; prueba el catálogo con contenido autorizado antes de diseñar streaming. Mantén móvil, pagos y streaming completo fuera del primer alcance.
