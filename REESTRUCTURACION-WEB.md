# Reestructuración web GENIDEIA — plan

## 1. Diagnóstico (resumen — auditoría completa corrida antes de este plan)

- Astro 5 + Tailwind 4, sin integraciones (islands), TS estricto, deploy en Vercel, todo SSG file-based.
- `index.astro` (847 líneas) mezcla en un solo scroll: hero, clientes, socios, 3 frentes de servicio (base/ads/automatización), 2 productos IA, método (3 pasos) duplicado con "cómo trabajar" (otros 3 pasos casi iguales), clientes reales (de nuevo, con datos inconsistentes respecto a la primera lista), formulario y CTA final.
- Nav solo tiene anclas de la home; `/nosotros` y `/feed` existen pero no están enlazadas.
- `/andres`, `/tadeo` y `/recursos/*` son landings de venta / lead magnets **autónomos** (su propio `<html>`, sin Nav/Footer) — **no se tocan** en esta reestructuración, son embudos independientes que ya funcionan.
- Branding: dos sistemas de tokens de color coexistiendo (`@theme` y `:root --gen-*`), casi todo el estilo va inline con `style=""` en vez de usar los tokens. `/nosotros` y `/feed` usan tipografía y acento distintos al resto (Cormorant Garamond + `#4ab8ff` vs Montserrat + `#00C8FF`).
- Clientes reales confirmados (8, con inconsistencias entre dos listas del mismo index.astro): Sara, Hecho con el Alma, Donher's, Lorena Da Silva / Asesores de Imperium (mismo dominio, dos nombres — a unificar), Vanzza, DMJ Studio, TBO Express.
- Testimonios: array `testimonios` con 3 placeholders `[pendiente]`, **no se renderiza en el DOM actual**. No hay testimonios textuales reales todavía.
- Formulario de diagnóstico intenta Netlify Forms en un proyecto deployado en Vercel → falla en silencio; solo funciona el envío por WhatsApp.
- Videos sin usar en `public/videos/`: `como-trabajo.mp4`, `presentacion.mp4` (con posters) — sin referencia en ninguna página.
- No hay analítica activa (Meta Pixel implementado pero apagado, solo en `/andres`).

## 2. Decisiones tomadas con el cliente (Andrés)

1. `/nosotros` pasa a ser la página "Nosotros" del nuevo menú — se ajusta tipografía/color para que sea consistente con el resto del sitio (Montserrat + `#00C8FF`). `/feed` queda como está, sin enlazar en el menú principal (accesible solo por URL directa).
2. `como-trabajo.mp4` y `presentacion.mp4` se integran en `/servicios/automatizaciones`.
3. Los clientes reales se muestran como "proyectos reales" con nombre + rubro + link — sin testimonios ni métricas inventadas. Etiqueta de servicio relacionado es una inferencia a partir del rubro/descripción disponible, marcada en `CONTENIDO-PENDIENTE.md` para que la confirmes.
4. Se saca el intento de Netlify Forms del formulario de diagnóstico; queda solo el envío por WhatsApp (que es lo único que hoy funciona realmente).

## 3. Nueva arquitectura de rutas

```
/                                  Home recortada: hero + selector de 4 servicios + método (unificado) + CTA
/nosotros                          Historia + socios (reutiliza contenido real de nosotros.astro + socios del index)
/casos                             Casos y clientes reales (unifica logos + confiaron, sin duplicar)
/servicios/contenido-marketing     Más desarrollada (más evidencia real disponible)
/servicios/anuncios
/servicios/presencia-digital
/servicios/automatizaciones        Incluye los 2 videos huérfanos + los 2 productos IA (bot whatsapp, sistema inmobiliarias)
/feed                              Sin cambios, sin enlazar en nav
/andres, /tadeo, /recursos/*       Sin cambios (landings autónomas)
```

## 4. Componentes nuevos (reutilizables, en `src/components/`)

- `Section.astro` — wrapper de sección con kicker/H2/subcopy consistente (reemplaza el markup repetido inline).
- `ServiceCard.astro` — tarjeta de servicio (usada en selector de home).
- `StepList.astro` — lista numerada de pasos (reemplaza la duplicación método/arranque).
- `ClientCard.astro` — tarjeta de "proyecto real" (nombre, rubro, badge de servicio, link).
- `FaqAccordion.astro` — acordeón de preguntas frecuentes (usa `<details>` nativo, accesible, sin JS extra).
- `CtaBand.astro` — banda de CTA final, contextual por página (recibe texto/servicio como prop).

## 5. Contenido que se reutiliza (real, no inventado)

- Fotos de Andrés y Tadeo (`/img/andres.jpg`, `/img/tadeo.jpg`).
- Los 8 clientes reales con nombre/URL/rubro (unificados en un solo array `src/data/clientes.ts`).
- Todo el copy real de los 3 frentes de servicio, método, socios — reescrito y redistribuido, no reescrito desde cero.
- Isotipo animado del hero (`symbol-gii.png` + canvas).
- Los 2 productos IA (bot WhatsApp, sistema de contenido inmobiliarias) con sus videos de YouTube ya embebidos.
- `como-trabajo.mp4` y `presentacion.mp4` con sus posters.
- Historia y valores de `/nosotros`.

## 6. Contenido pendiente (ver `CONTENIDO-PENDIENTE.md`)

- Testimonios textuales reales.
- Confirmación de a qué servicio corresponde cada cliente.
- Corrección de rubro real de Donher's y Hecho con el Alma (hoy inconsistente entre las dos listas).
- Confirmación: ¿"Lorena Da Silva" y "Asesores de Imperium" son el mismo cliente?

## 7. Riesgos técnicos

- Mover contenido del home a páginas nuevas puede romper enlaces `#ancla` existentes que la gente ya tenga guardados/compartidos → se agregan anclas de compatibilidad donde sea barato hacerlo, sin sobre-invertir.
- `/nosotros` cambia de tipografía/color → revisar que no rompa legibilidad.
- Formulario: al sacar Netlify Forms hay que confirmar que el submit siga abriendo WhatsApp igual que antes (no se toca esa lógica, solo se quita el `fetch` muerto).

## 8. Orden de implementación

1. Componentes reutilizables + `src/data/clientes.ts` (fuente única de clientes).
2. Nav.astro (nuevo menú + submenu servicios + mobile).
3. Home recortada (hero + selector + método unificado + CTA).
4. 4 páginas de servicio.
5. `/casos`.
6. `/nosotros` (ajuste de marca).
7. Fix formulario.
8. SEO por página (title/description/OG únicos).
9. Build + revisión responsive + consola + enlaces.
10. `CONTENIDO-PENDIENTE.md` + resumen final.
