# Academy: contención de la exposición actual (propuesta única)

Nada de esto se ejecutó. Cada paso cambia producción y requiere tu OK. Todos los pasos de contención son reversibles. Las eliminaciones irreversibles están separadas en la sección 4.

Hosts concretos e inventario de deployments: fuera del repo (el repo es público).

## Contención (reversible)

### 1. Rutas privadas del dominio principal (Cloudflare, zona genideiacompany.com)
- Recurso: Security → WAF → Custom rules. Regla nueva, acción **Block**.
- Expresión: `lower(http.request.uri.path) matches "^/academy/(alumnos|sesiones|panel|data)(/|$)"`
- Impacto: alumnos y admin pierden acceso a esas rutas en el dominio principal hasta que se decida el cierre definitivo. Las páginas comerciales no cambian.
- Reversión: deshabilitar o borrar la regla. Efecto inmediato.
- Verificación: `curl` con código de estado sobre `/academy/alumnos/<slug>/`, `/academy/sesiones/`, `/academy/panel/`, `/academy/data/public-plans.json`, y variantes codificadas (`/%61cademy/…`, `//academy/…`). Si alguna variante devuelve 200, la regla no la cubre y hay que agregar otra expresión; no se da por cerrado con sólo la regla.

### 2. Panel y dominios alternativos de Vercel (proyecto genideia-academy)
- Recurso: Settings → Domains del proyecto `genideia-academy`. Quitar `academy.genideiacompany.com` y `genideia-academy.vercel.app`.
- Impacto: el panel deja de ser accesible en esos hosts. No se borra ningún deployment.
- Reversión: volver a agregar cada dominio. Efecto cuando Vercel reasigna el alias (segundos a minutos).
- Verificación: `curl` a ambos dominios debe dar error de dominio no asignado (no 200).
- Los deployments de hash (`…-projects.vercel.app`) ya responden 302 a SSO de Vercel. No se tocan en esta fase.

### 3. URLs antiguas de Pages (`*.genideia-web.pages.dev`)
Bloquear sólo el dominio principal no protege las URL de hash: siguen públicas (200) con planes antiguos.
- Recurso: Zero Trust → Access → Applications. Nueva aplicación **self-hosted** para el hostname `*.genideia-web.pages.dev`. Política: Allow sólo al email del owner. Requiere un proveedor de identidad (p. ej. One-time PIN por email).
- Impacto: todas las URL `pages.dev` del proyecto (previews, deployments antiguos y producción por esa URL) piden login. El dominio propio `genideiacompany.com` no cambia.
- Reversión: borrar la aplicación de Access.
- Verificación: `curl` sobre `34754832.genideia-web.pages.dev` y `11cd537e.genideia-web.pages.dev` debe responder redirect a login de Access, no 200.

### Orden
1 → verificar → 2 → verificar → 3 → verificar. Si un paso rompe algo, revertir ese paso antes de seguir.

## Decisiones que necesito de vos (en lote)
1. OK para aplicar los pasos 1, 2 y 3 en producción (son reversibles).
2. Proveedor de identidad para Access (paso 3): One-time PIN por email al `owner` alcanza.
3. Crear un proyecto nuevo de Vercel para el panel (Root Directory `academy/`) y reasignarle los dominios del paso 2. Sin ese proyecto, el modo panel no tiene dónde ejecutarse y no se puede validar en Vercel real.

## 4. Eliminaciones irreversibles (separadas, no incluidas en la contención)
Ninguna se hace sin confirmación explícita por grupo.
- Cloudflare Pages: deployments `34754832` y `11cd537e`, y cualquier deployment anterior al commit de protección. Se pierde la capacidad de abrir esa versión exacta. El código sigue en Git.
- Vercel: los 13 deployments con SSO y los dos despliegues de producción anteriores a `b384dff`. Mismo efecto.
- Historial de Git: reescribir con `git filter-repo` + force push. Irreversible para cualquier clon existente.
- Cambio de visibilidad del repo a privado: **reversible** (se puede volver a público), pero no borra lo ya clonado. Se decide aparte.

## Orden sugerido después de la contención
1. Mergear el PR cuando el preview de Cloudflare y el proyecto de panel en Vercel estén verificados.
2. Verificar en producción con la checklist de `docs/academy-acceso.md`.
3. Recién después, decidir sobre las eliminaciones de la sección 4.
