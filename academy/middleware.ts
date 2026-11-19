// Proyecto de Vercel DEDICADO AL PANEL (Root Directory = academy/).
// Modo panel: toda ruta y todo host exigen admin. No depende de nombres de host.
import { next } from '@vercel/functions';
import { createAcademyMiddleware, MODE_PANEL } from '../lib/academy-vercel.mjs';

// Matcher total: el panel no tiene rutas públicas, ni siquiera estáticas.
export const config = { matcher: '/(.*)' };

export default createAcademyMiddleware(next, () => process.env as Record<string, string | undefined>, MODE_PANEL);
