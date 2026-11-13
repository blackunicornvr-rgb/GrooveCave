# Arquitectura técnica propuesta

## MVP en Cloudflare

La primera versión usa servicios de Cloudflare para mantener el despliegue sencillo:

```text
Navegador → Cloudflare Pages (HTML/CSS/JS)
                    └─ Pages Function: POST /api/waitlist
                         ├─ Turnstile (verificación anti-spam)
                         └─ D1 (solicitudes de lista de espera)
```

La landing es estática; la función valida el formulario en servidor. No hay clave de base de datos expuesta al navegador ni endpoint público para leer solicitudes. La configuración paso a paso está en `web/README.md`.

## Componentes

- **Pages:** publica los archivos de `web/` (raíz `web`, salida `.`).
- **Pages Functions:** `web/functions/api/waitlist.js` procesa las altas.
- **D1:** almacena únicamente nombre, email, rol, mensaje opcional, consentimiento y fecha.
- **Turnstile:** protege el formulario; la secret key se almacena como secret del entorno Pages.

## Seguridad y privacidad

- Aplicar validación de servidor, límites de longitud, consentimiento y honeypot.
- Verificar Turnstile en servidor; mantener su secret fuera del código y del cliente.
- No habilitar lecturas públicas de la tabla. Acceder a los registros desde el panel autenticado de Cloudflare.
- Antes de aceptar datos reales, publicar un aviso de privacidad que indique responsable, finalidad, retención, derechos y contacto conforme a la jurisdicción aplicable.
- Configurar reglas de rate limiting si se detecta abuso y borrar periódicamente solicitudes que ya no sean necesarias.

## Evolución

Supabase u otros servicios pueden evaluarse en el futuro para autenticación, perfiles y catálogo, pero no hacen falta para validar esta landing. El almacenamiento y la distribución de audio requieren una revisión separada de derechos, costes, entrega y protección antes de habilitar cargas.
