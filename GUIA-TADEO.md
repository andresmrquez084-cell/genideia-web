# Guía para editar la landing de Tadeo (con Claude Code)

Hola 👋 Este documento es para que **Claude Code te ayude a ver y editar tu propia landing** de forma segura.
Si sos Claude Code leyendo esto: seguí estas reglas **al pie de la letra**.

---

## 🚦 Regla de oro

**El ÚNICO archivo que se edita es `src/data/tadeo.json`.**

- ✅ Cambiar textos y la foto = editar `src/data/tadeo.json` (y reemplazar la imagen en `public/img/`).
- ❌ NO tocar `src/pages/tadeo.astro` ni componentes, estilos, configs o cualquier otro archivo.
- ❌ NO instalar dependencias nuevas ni cambiar la estructura del proyecto.

El diseño, los colores, las animaciones y el código están blindados a propósito. Tadeo no es técnico:
el objetivo es que pueda cambiar **qué dice** su página sin riesgo de romper nada.

---

## 🖥️ Cómo ver la landing en local (preview)

1. Instalar dependencias (una sola vez): `npm install`
2. Levantar el preview: `npm run dev`
3. Abrir en el navegador la URL que imprime la terminal y agregarle **`/tadeo`**
   (por ejemplo: `http://localhost:4321/tadeo`).
4. Cada vez que se guarda `tadeo.json`, la página se actualiza sola.

Claude Code: arrancá el preview vos y confirmale a Tadeo que ya puede mirarlo en el navegador.

---

## ✍️ Cómo editar (qué controla cada campo)

Todo está en `src/data/tadeo.json`. Solo se cambia el **texto entre comillas**.
Nunca borres las comillas `" "`, las llaves `{ }`, los corchetes `[ ]` ni las comas `,`.

Mapa de campos → qué se ve en la página:

| En el JSON | Qué cambia en la web |
|------------|----------------------|
| `whatsapp` | Tu número de WhatsApp (solo números, sin + ni espacios). Lo usan todos los botones. |
| `whatsappMensajeInicial` | El mensaje que aparece pre-escrito cuando alguien te escribe. |
| `seo.*` | Título y descripción que se ven en Google y al compartir el link. |
| `marca.nombre` / `marca.etiqueta` | Tu nombre y la etiqueta ("Ads") arriba a la izquierda. |
| `hero.*` | La portada: el título grande ("Más clientes, todos los meses."), el subtítulo y los botones. |
| `hero.foto` | La ruta de tu foto (por defecto `/img/tadeo.jpg`). |
| `quienSoy.*` | Sección **01 · Quién soy**: tu bio. |
| `queHago.*` | Sección **02 · Qué hago**: el título y la lista de servicios (`items`). |
| `comoLoHago.*` | Sección **03 · Cómo lo hago**: los 3 pasos. |
| `trabajar.*` | Sección **04 · Trabajar conmigo**: pasos + los textos y opciones del formulario. |
| `footer.*` | El pie de página. |

Para agregar/quitar un servicio en `queHago.items` o un paso, copiá el formato exacto de los que ya están.

---

## 🖼️ Cómo cambiar la foto

Reemplazá el archivo `public/img/tadeo.jpg` por la foto nueva **con el mismo nombre** (`tadeo.jpg`).
Ideal: vertical (retrato), buena luz, fondo limpio. Si querés usar otro nombre, cambialo también en `hero.foto`.

---

## ✅ Antes de terminar

Claude Code, antes de dar por hecho un cambio:
1. Confirmá que `tadeo.json` sigue siendo un JSON válido (sin comas ni comillas de más/menos).
2. Mostrale a Tadeo el resultado en el **preview** (`/tadeo`).
3. Explicale en **español simple** qué cambiaste, sin tecnicismos.

---

## 🚀 Cómo se publica (importante)

Los cambios que hacés acá son **locales** (los ve Tadeo en su compu). Para que aparezcan en la web real
`genideiacompany.com/tadeo`, **la publicación final la hace Andrés** (la web se sube desde su cuenta).

Cuando Tadeo esté conforme con los cambios:
- Claude Code puede guardar los cambios (commit) y avisar.
- **Tadeo le avisa a Andrés** que ya están listos para que él los publique.

(No intentes desplegar a producción vos — el deploy está atado a la cuenta de Andrés.)

---

## 🆘 Si algo sale mal

Si el preview muestra un error o la página se ve rota, casi siempre es una coma o comilla mal en
`tadeo.json`. Pedile a Claude Code que **revise el JSON** o que **deshaga el último cambio**. Ante la duda,
no publicar y avisarle a Andrés.
