// Proyecto de Vercel del SITIO comercial (raíz del repo). Modo sitio:
// sólo las rutas privadas de /academy/* exigen sesión; el resto es público.
import { next } from '@vercel/functions';
import { createAcademyMiddleware, MODE_SITE } from './lib/academy-vercel.mjs';

export const config = { matcher: '/((?!_astro/|favicon\\.(?:ico|png|svg)|apple-touch-icon\\.png).*)' };

export default createAcademyMiddleware(next, () => process.env as Record<string, string | undefined>, MODE_SITE);
