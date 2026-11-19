# Academy: acceso privado (runbook)

## Recorrido
- **Alumno:** entra a `/academy/acceso`, con usuario y clave que le da el admin. Va a `/academy/alumnos/<su-slug>`. Cualquier otra ruta privada le devuelve su propio plan o 403.
- **Admin:** mismo login. Accede a todos los planes, a `/academy/sesiones/` y al panel.
- **Público:** `/`, `/academy/`, `/academy/1a1/`, `/academy/grupal/`, `/academy/acceso/` y el resto de páginas comerciales.

## Dónde se verifica
- `functions/_middleware.js` corre en Cloudflare Pages **antes** de servir cualquier archivo. La identidad se valida con HMAC.
- El rol, el slug y las bajas se leen de `ACADEMY_USERS_JSON` **en cada request**. El token solo prueba quién es y cuándo se emitió.

## Variables (Cloudflare Pages → Settings → Environment variables, tipo Secret)
| Nombre | Obligatoria | Uso |
|---|---|---|
| `ACADEMY_SESSION_SECRET` | sí | 32+ caracteres. Sin ella, todo lo privado queda cerrado |
| `ACADEMY_USERS_JSON` | sí | `{"usuario":{"password":"…","role":"admin"\|"student","slug":"…","disabled":false,"validAfter":"ISO"}}` |
| `ACADEMY_PLANS_JSON` | para publicar planes | JSON con `{version, updatedAt, students:[…]}`. Se lee en el build |
| `ACADEMY_LOCKDOWN` | no | `1` cierra todas las rutas privadas y el login |
| `ACADEMY_KV` (binding) | no | KV para revocación instantánea |

Los planes no viven en el repo. Para trabajar en local, copiá el archivo a `private/academy/public-plans.json` (ignorado por git).

## Revocar acceso
- **Dar de baja un usuario:** poner `"disabled": true` en `ACADEMY_USERS_JSON` y volver a desplegar. Requiere un deploy nuevo.
- **Revocación inmediata (sin deploy):** crear en el KV `ACADEMY_KV` la clave `revoke:<usuario>` con el valor `Date.now()` (ms). Toda sesión emitida antes de ese momento deja de valer.
- **Cambio de permisos o slug:** se aplica al próximo request, porque el middleware lee la configuración actual.
- **Invalidar a todos:** rotar `ACADEMY_SESSION_SECRET`.

## Cerrar todo (lockdown)
Poner `ACADEMY_LOCKDOWN=1` y volver a desplegar. Responde 503 en rutas privadas y en el login. Las páginas comerciales siguen públicas.

## Rollback seguro
**No revertir el PR como única salida.** Hay dos riesgos:
1. Cada deployment de Pages tiene su propia URL (`<hash>.genideia-web.pages.dev`). Los deployments anteriores a `3e66917` **sirven los planes sin protección** (verificado: `34754832.genideia-web.pages.dev/academy/alumnos/mauro/` responde 200). Nunca restaurar a esos deployments.
2. Revertir el commit en `main` vuelve a publicar datos si el repo todavía los tiene.

Procedimiento:
1. Activar `ACADEMY_LOCKDOWN=1` (cierra el acceso sin tocar código).
2. Si hace falta volver atrás, elegir solo deployments con `functions/_middleware.js` (commit `3e66917` o posterior).
3. Verificar con `npm test` y con `curl` que las rutas privadas devuelven 302/403/503 sin contenido.
4. Solo después, decidir sobre el código.

## Deployments viejos y historial (pendiente de decisión)
- Deployments de Pages anteriores a la protección siguen publicados en sus URLs de hash. Hay que eliminarlos desde el dashboard. **No eliminé nada:** es irreversible y requiere confirmación.
- El repositorio es público y el historial conserva datos de alumnos y versiones anteriores del `SEED`. Quitarlos del árbol no los borra del historial. Opciones: (a) hacer el repo privado (decisión de visibilidad), (b) reescribir historial con `git filter-repo` y forzar el push. Ninguna se ejecutó en este PR.

## Pruebas
```bash
npm test
```
Usa cuentas y datos sintéticos. Cubre permisos, sesión, bajas, revocación, lockdown y rutas alternativas.
