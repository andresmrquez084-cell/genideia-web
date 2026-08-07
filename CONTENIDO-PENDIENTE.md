# Contenido pendiente — reestructuración web

Lo que falta para que cada sección quede 100% respaldada por evidencia real. Nada de esto bloqueó la implementación — la estructura ya está construida y lista para completarse.

## 1. Confirmar la categoría de servicio de cada cliente

En `src/data/clientes.ts` cada cliente quedó etiquetado con un servicio (`contenido-marketing`, `presencia-digital`, `automatizaciones`) según la mejor inferencia posible a partir del rubro y las narrativas de `feed.astro`. Estas son las que necesitan tu confirmación o corrección:

| Cliente | Servicio asignado | Base de la inferencia |
|---|---|---|
| Sara | Contenido y marketing | Feed.astro: "fase de marketing digital" |
| Hecho con el Alma | Contenido y marketing | Feed.astro: "sistema de contenido y estructura de conversión" |
| Donher's | Presencia digital | Solo tengo nombre + URL, sin narrativa — confirmar |
| TBO Express | Presencia digital | Solo tengo nombre + URL, sin narrativa — confirmar |
| Asesores de Imperium | Automatizaciones | Asumí relación con "Sistema de contenido para inmobiliarias" — confirmar si es así |
| Vanzza | Presencia digital | Su propia URL dice "prototipo" — lo etiqueté como Prototipo funcional, no proyecto real |
| DMJ Studio | Presencia digital | Solo tengo nombre + URL, sin narrativa — confirmar |

Ningún cliente quedó tageado en "Anuncios" — no había evidencia de ningún caso de publicidad paga. Por eso esa página no tiene sección de casos (se ocultó automáticamente).

## 2. Testimonios textuales reales

No hay ninguno cargado todavía (el array viejo tenía placeholders `[pendiente]` que nunca se mostraban). Si me pasás frases reales de clientes — con autorización para publicarlas — las agrego a `/casos` y a la página de servicio correspondiente.

## 3. Resultados / métricas verificables

Hoy ningún cliente tiene un resultado numérico (ej. "+40% en reservas") documentado en el código. Si tenés alguno confirmado por el cliente, decime a cuál corresponde y lo sumo a su tarjeta en `/casos`.

## 4. Fotos y capturas de los proyectos

Las tarjetas de `/casos` hoy solo muestran nombre + rubro + link (sin imagen). Si tenés capturas o fotos de cada proyecto (con autorización), las integro.

## 5. Videos huérfanos ya integrados

`como-trabajo.mp4` y `presentacion.mp4` (con sus posters) ya están en `/servicios/automatizaciones`, según lo que definiste. Si el contenido real de esos videos no encaja ahí, avisame y los reubico.

## 6. Archivos sin uso detectados en la auditoría (no tocados)

- `public/img/logo-genideia.png` (1.2 MB) — no encontré dónde se usa. Revisar si se puede borrar u optimizar.
- `public/logo-wsp.jpg` — placeholder ya marcado como pendiente en el README original, sigue sin usarse.

## 7. Meta Pixel

Sigue implementado pero apagado en `/andres` (`FB_PIXEL_ID = ''`). No lo toqué — actívalo pegando el ID cuando tengas el Business Manager.
