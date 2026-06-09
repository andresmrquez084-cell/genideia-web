# GENIDEIA IA — Sitio web

Sitio oficial de GENIDEIA IA (Andrés Albornoz, co-founder). Astro 5 + Tailwind 4, estático.

## Páginas
- `/` — home (servicios, herramientas, clientes, cómo funciona, diagnóstico)
- `/nosotros` — historia y forma de trabajar
- `/feed` — el diario (casos, herramientas, insights)

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # genera dist/
```

> En esta Mac, node está vía nvm. Si `npm` no aparece:
> `export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"`

## Deploy
Vercel (proyecto `genideia-ia`). `main` → producción. Cambios siempre por rama + PR (Vercel genera preview del PR).

## Pendiente
- Reemplazar `public/logo-wsp.jpg` (hoy hay un placeholder).
- El form de diagnóstico usa Netlify Forms — si el deploy queda en Vercel, migrar a webhook n8n.
