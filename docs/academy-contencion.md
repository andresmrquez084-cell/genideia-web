# Academy: contención externa (pendiente de decisión)

Nada de esta lista se ejecutó. Cada acción cambia producción, borra algo o cambia visibilidad, y requiere confirmación explícita. El inventario con hosts concretos está fuera del repo, porque este repositorio es público.

## 1. Exposición activa ahora (prioridad máxima)
Verificado con GET (solo código de estado) el 2026-11-19:
- `genideiacompany.com/academy/alumnos/<slug>/` → 200 sin login. `main` versiona los planes de alumnos (23 archivos) y Cloudflare sirve `main` en producción sin middleware.
- `genideiacompany.com/academy/sesiones/` → 200 sin login.
- Panel de Vercel (`academy.genideiacompany.com` y el alias `genideia-academy.vercel.app`) → 200 sin login. El despliegue de producción contiene un bloque de datos embebido.

Estas rutas **no se corrigen con este PR**: el PR cambia `main` sólo cuando se mergea, y el despliegue actual de producción no pasa por el middleware nuevo.

Opciones para cerrar **antes** del merge (cada una es un cambio de configuración de producción que requiere tu OK):
- **A (recomendada, rápida y reversible):** regla de WAF en Cloudflare que responda 403 a `genideiacompany.com/academy/alumnos/*`, `/academy/sesiones/*`, `/academy/panel/*`, `/academy/data/*`. Se quita desde el mismo panel.
- **B:** Cloudflare Access (Zero Trust) sobre esas mismas rutas. Requiere un proveedor de identidad; más trabajo.
- **C (Vercel):** quitar los dominios `academy.genideiacompany.com` y `genideia-academy.vercel.app` del proyecto (Settings → Domains). Se vuelven a agregar cuando haga falta. No borra deployments.
- **D (Vercel):** activar Deployment Protection (Vercel Authentication) en producción. Alternativa a C.

No puedo confirmar por qué el middleware de Vercel no bloquea el panel: el dominio responde `x-vercel-cache: HIT` con 200. Hay que revisar los Logs del deployment de producción antes de confiar en él.

## 2. Deployments viejos
### Cloudflare Pages (`genideia-web`)
- Conocidos y públicos con contenido sensible: el deployment de hash `34754832` (planes sin protección) y `11cd537e` (commit `3e66917`, con bypass). Ambos responden 200.
- No tengo acceso al listado completo desde aquí. Hay que revisarlo en el dashboard: Workers & Pages → genideia-web → Deployments.
- Qué borrar: todo deployment cuyo commit sea anterior a la protección, y cualquier preview con carpeta `academy/alumnos` o `alumnos/`.
- Qué no borrar: el deployment de producción activo.
- Qué se pierde: la posibilidad de abrir esa versión exacta. El código sigue en Git, así que se puede reconstruir desde el commit. Es irreversible para ese deployment.

### Vercel (`genideia-academy`)
- 20 deployments (inventario fuera del repo). 13 responden 302 a SSO de Vercel: no son públicos, pero conservan el contenido. 7 ya responden 410 (eliminados).
- Qué borrar: los previews con 302 y los dos despliegues de producción anteriores a `b384dff`. Son versiones prohibidas como rollback (ver runbook).
- Qué no borrar: el deployment de producción actual hasta que haya uno nuevo verificado.
- Qué se pierde: la posibilidad de volver a esas versiones. Irreversible para cada deployment.

## 3. Repositorio público → privado
Comando (no ejecutado): `gh repo edit <owner>/<repo> --visibility private --accept-visibility-change-consequences`

Efecto y verificación antes:
- **Historial:** no cambia. Quien ya clonó o tiene una copia en caché sigue teniendo los datos. Hacerlo privado no borra el historial. Para eso haría falta reescribirlo (`git filter-repo` + force push), decisión aparte.
- **Vercel:** la integración con GitHub sigue si la app de Vercel tiene acceso al repo. Verificar en Project → Settings → Git (repositorio conectado) y disparar un deploy de prueba.
- **Cloudflare Pages:** verificar en Settings → Builds & deployments que el repo sigue conectado y que el próximo build corre.
- **Vercel Preview Comments** (check de PR): depende de la misma app; verificar.
- **GitHub Actions:** el workflow `content-os-sync` corre cada hora. Sigue funcionando en repo privado, pero consume minutos del plan.
- **Forks:** 0 al 2026-11-19.
- **Colaboradores:** mantienen acceso. Enlaces públicos a archivos del repo (en docs o Notion) dejan de funcionar.

Recomendación: hacerlo después de la contención de las secciones 1 y 2, y después de confirmar que las integraciones siguen operativas.

## 4. Orden sugerido
1. Decidir la opción de la sección 1 (A, B, C o D) y aplicarla con tu OK.
2. Verificar con `curl` que las rutas privadas responden 403/302 en producción.
3. Borrar deployments viejos (sección 2), con tu OK por cada grupo.
4. Cambiar visibilidad del repo (sección 3), con tu OK.
5. Recién después, mergear el PR y verificar el preview de producción con la checklist de `docs/academy-acceso.md`.
