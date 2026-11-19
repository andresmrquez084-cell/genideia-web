// Vercel middleware de Academy. Lógica en ../lib/academy-vercel.mjs (compartida con Cloudflare).
import { next } from '@vercel/functions';
import { createAcademyMiddleware } from '../lib/academy-vercel.mjs';

export const config = { matcher: '/((?!_astro/|favicon\\.(?:ico|png|svg)|apple-touch-icon\\.png).*)' };

export default createAcademyMiddleware(next, () => process.env as Record<string, string | undefined>);
