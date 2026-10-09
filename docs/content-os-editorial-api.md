# Content OS — API editorial (v1)

La interfaz presenta **Competidores**, **Métricas y estadísticas** y **Contenido planificado**. Métricas continúa leyendo las publicaciones existentes; el módulo editorial utiliza dos tablas persistentes nuevas en Supabase: `content_os_editorial_records` y `content_os_editorial_history`.

## Integración desde Claude, ChatGPT o automatizaciones

Endpoint en el dominio de Content OS: `/api/content-os/editorial`.

- `GET`: lista registros e historial del workspace.
- `POST`: crea un registro editorial.
- `PATCH`: actualiza por UUID y exige `expectedRevision` para impedir sobrescrituras accidentales.
- Acceso en navegador: sesión autenticada existente de Content OS.
- Acceso remoto: token Bearer guardado **solo** en la variable de entorno de Vercel `CONTENT_OS_EDITORIAL_API_TOKEN`. Configurar un valor aleatorio largo desde el panel de Vercel, sin incluirlo en commits, chats, URLs ni código cliente. La integración remota estará deshabilitada hasta entonces.

Ejemplo de alta desde una aplicación conectada (enviar token desde el entorno del servidor):

```json
{
  "kind": "plan",
  "title": "10 usos de Claude",
  "format": "Reels",
  "status": "Guion",
  "topic": "Claude",
  "folder": "2026/10/Reels",
  "scheduledAt": "2026-10-15",
  "body": "Hook, desarrollo y CTA",
  "notes": "Segunda versión"
}
```

Para actualizar, enviar también `id` y `expectedRevision` obtenidos de `GET`. Los campos editoriales quedan dentro de `payload`, y cada escritura guarda una instantánea con fecha, número de revisión y origen.

## Antes de producción

- Revisar preview autenticada y probar alta, edición, recarga y conflicto de versiones.
- Configurar token de integración externo para clientes de confianza.
- Migrar registros locales previos únicamente mediante importación revisada; nunca sobrescribir los actuales.
- Los campos de métricas ausentes no deben interpretarse como ceros reales.
- No ejecutar limpieza de tablas heredadas sin inventario y respaldo.
