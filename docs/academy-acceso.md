# Academy: acceso privado (runbook)

## Piezas
- `lib/academy-auth.mjs`: token, permisos y decisiones. **Único** código de autorización.
- `functions/_middleware.js`: Cloudflare Pages. Hace el login (`/academy/acceso`) y protege `/academy/*` en `genideiacompany.com`.
- `lib/academy-vercel.mjs` + `middleware.ts` (raíz): Vercel. Protege el panel en `academy.genideiacompany.com` y `genideia-academy.vercel.app`. **No emite tokens.**
- `scripts/prebuild-academy-data.mjs`: prepara los planes y valida la configuración antes del build.

## Recorrido
- **Alumno:** `/academy/acceso` → `/academy/alumnos/<su-slug>`. Otro plan → 302 a su propio plan. Panel → 303 al login.
- **Admin:** mismo login → `academy.genideiacompany.com`. Accede a todos los planes, `/academy/sesiones/` y el panel.
- **Público:** `/`, `/academy/`, `/academy/1a1/`, `/academy/grupal/`, `/academy/acceso/` y el resto de páginas comerciales.

Cookie `genideia_academy`: `HttpOnly; Secure; SameSite=Lax; Domain=.genideiacompany.com`, 7 días. Contiene `{u, iat, exp}` firmado con HMAC-SHA256. Rol, slug y bajas **no** viajan en el token: se leen de `ACADEMY_USERS_JSON` en cada request.

## Variables
Deben estar **iguales** en Cloudflare Pages y en Vercel (mismo proyecto de configuración, dos copias).

| Nombre | Dónde | Obligatoria | Uso |
|---|---|---|---|
| `ACADEMY_SESSION_SECRET` | runtime (ambos) | sí | 32+ caracteres. Sin ella, todo lo privado queda cerrado |
| `ACADEMY_USERS_JSON` | runtime (ambos) | sí | `{"usuario":{"password":"…","role":"admin"\|"student","slug":"…","disabled":false,"validAfter":"ISO"}}` |
| `ACADEMY_PLANS_JSON` | **build** (ambos) | sí en producción | `{version, updatedAt, students:[…]}`. Se lee al compilar |
| `ACADEMY_LOCKDOWN` | runtime (ambos) | no | `1` cierra rutas privadas y login |
| `ACADEMY_KV` | binding (sólo Cloudflare) | no | Revocación por usuario. Ver "Consistencia" |

Los planes no viven en el repo. En local: `private/academy/public-plans.json` (ignorado por git).

### Guardia de build (`prebuild`)
En producción (`CF_PAGES_BRANCH=main` o `VERCEL_ENV=production`) el build **falla** si falta `ACADEMY_PLANS_JSON`, `ACADEMY_SESSION_SECRET` o un `ACADEMY_USERS_JSON` con un admin activo. Cloudflare y Vercel conservan entonces el deployment anterior. Así no se publica una Academy sin planes ni sin login.
- Limitación: el guardia sólo ve las variables que el build recibe. `ACADEMY_SESSION_SECRET` y `ACADEMY_USERS_JSON` deben confirmarse también en runtime con la prueba de login del preview de producción (ver checklist).

## Consistencia de la revocación (importante)
No hay revocación instantánea global. Hay tres mecanismos con propagación distinta:

| Cambio | Cuándo surte efecto | Garantía |
|---|---|---|
| Editar `ACADEMY_USERS_JSON` (baja, rol, slug, `validAfter`) | Cuando **ese** entorno recibe la variable en un deployment nuevo | Depende del deploy de cada plataforma. Entre Cloudflare y Vercel puede haber una ventana |
| Clave KV `revoke:<usuario>` (sólo Cloudflare) | Lo que tarde KV en propagarse globalmente. Cloudflare documenta hasta ~60 s, sin garantía fuerte | **Eventual.** Vercel no lee ese KV |
| Rotar `ACADEMY_SESSION_SECRET` | Cuando ambos entornos despliegan el secreto nuevo | Corta **todas** las sesiones, pero también en un deploy |

La prueba `ventana de propagación` en `tests/academy-journey.test.mjs` documenta el caso real: si sólo un entorno recibió la baja, el otro sigue aceptando hasta actualizarse.

**Consecuencia:** para una baja urgente, hacer las tres cosas: (1) `disabled: true` en ambos entornos, (2) `revoke:<usuario>` en KV, (3) redeploy de ambos. Y aceptar que la ventana existe.

### Revocación estricta (propuesta, no implementada)
Si hace falta corte inmediato y verificable, la opción es una **tabla de sesiones en Supabase** (`academy_sessions`: `id`, `username`, `issued_at`, `revoked_at`). Cada request valida el `sid` del token contra esa tabla antes de decidir. Revocar = `update revoked_at = now()`. Efecto: en el siguiente request. Costo: una consulta por request protegido; si la consulta falla, se deniega. Alcance: ambos entornos llaman a la misma base, así que no hay ventana entre plataformas. Requiere una decisión tuya antes de implementarla.

## Versiones permitidas para deploy o rollback
Un deployment sólo puede ser objetivo de rollback si cumple **las tres** condiciones:
1. Contiene `lib/academy-auth.mjs` y `functions/_middleware.js` que lo usa.
2. Pasa `npm test` completo (40 pruebas) en ese commit.
3. Su Vercel usa `lib/academy-vercel.mjs` (si no, sus tokens y sus permisos no coinciden con Cloudflare).

**Prohibidos, aunque sea más fácil volver:**
- Cualquier commit anterior a `a7b5723`: no tiene protección, sirve planes.
- `3e66917`: **bypass confirmado** (rutas codificadas y barras repetidas devolvían 200 con el plan).
- `da6e1d3`: su Vercel espera `role` dentro del token; no es compatible con el flujo cruzado.
- Deployments de hash viejos (`34754832.genideia-web.pages.dev`, etc.): sirven planes sin protección.

Revertir el PR no alcanza: el deployment de producción y las URL de hash siguen existiendo.

## Procedimiento de rollback
1. `ACADEMY_LOCKDOWN=1` en **ambos** entornos y redeploy. Esto cierra el acceso sin tocar código.
2. Elegir sólo un deployment que cumpla la lista de arriba. Si no hay ninguno, quedarse en lockdown.
3. Verificar con `curl` (ver checklist) que las rutas privadas devuelven 302/303/403/503 sin contenido.
4. Recién después, decidir sobre el código.

Tras un rollback, las sesiones emitidas por la versión anterior dejan de valer (token distinto): los alumnos vuelven a iniciar sesión.

## Checklist de preview y producción (sintético)
Usar sólo cuentas sintéticas. No pegar contraseñas reales ni tokens en el ticket.
- [ ] Visitante sin cookie: `/academy/alumnos/<slug>/` → 302 al login, sin HTML.
- [ ] Alumno: su plan → 200; plan ajeno → 302; panel → 303.
- [ ] Admin (Cloudflare login) → panel en Vercel 200; `/academy/sesiones/` 200.
- [ ] Rutas codificadas y barras repetidas: `/%61cademy/alumnos/x/`, `//academy/alumnos/x/`, `/academy/%61lumnos/x/` → nunca 200 con contenido privado.
- [ ] Archivos privados (`/academy/data/…`) sin admin → sin contenido.
- [ ] `ACADEMY_LOCKDOWN=1` → 503 en privadas y login; público sigue 200.
- [ ] Baja de un usuario de prueba → sus rutas bloquean en ambos entornos tras el redeploy.

Comandos de referencia (reemplazar `<preview>`):
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<preview>/academy/alumnos/alumno-a/
curl -s -o /dev/null -w "%{http_code}\n" "https://<preview>//academy/alumnos/alumno-a/"
```

## Contención externa (no ejecutada)
Ver `docs/academy-contencion.md`: lista de deployments expuestos, cómo retirarlos, qué se pierde, y el cambio del repo a privado con su efecto en integraciones.

## Pruebas
```bash
npm test
```
Cuentas y datos sintéticos (40 pruebas). `tests/academy-access.test.mjs`: permisos, sesión, bajas, revocación, lockdown, rutas alternativas. `tests/academy-journey.test.mjs`: recorrido Cloudflare → Vercel, degradación y baja en ambos, ventana de propagación, tokens inválidos.

Build de producción con plan sintético (reproducible, no toca datos reales):
```bash
CF_PAGES_BRANCH=main \
ACADEMY_PLANS_JSON="$(cat tests/fixtures/plan-sintetico.json)" \
ACADEMY_SESSION_SECRET=secreto-sintetico-de-prueba-0123456789abcdef \
ACADEMY_USERS_JSON='{"admin-test":{"password":"clave-admin-test","role":"admin"}}' \
npm run build
```
Sin `ACADEMY_PLANS_JSON` (o sin secreto/admin), el mismo build con `CF_PAGES_BRANCH=main` debe **fallar** con código 1.
