// Middleware de Vercel para Academy. Usa el MISMO núcleo que Cloudflare
// (lib/academy-auth.mjs). Vercel no emite tokens: el login vive sólo en Cloudflare.
//
// Dos modos. No se distinguen por nombre de host: cada proyecto de Vercel usa uno.
//
//   MODE_PANEL  Proyecto dedicado al panel (Root Directory = academy/).
//               TODA ruta, en CUALQUIER host (dominios de deployment, aliases nuevos),
//               exige admin. Sin sesión: redirige al login. Sesión sin admin: 403.
//               Lockdown: 503 en todas las rutas.
//
//   MODE_SITE   Proyecto del sitio comercial (raíz del repo).
//               Sólo protege las rutas de PROTECTED (lib/academy-auth.mjs).
//               Páginas públicas: sin cambios.

import { decideProtected, normalizePath, protectedRule, readIdentity } from './academy-auth.mjs';

export const MODE_PANEL = 'panel';
export const MODE_SITE = 'site';

const LOGIN_PANEL = 'https://genideiacompany.com/academy/acceso?next=panel';
const ADMIN_HOME = 'https://academy.genideiacompany.com/';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

const text = (body, status) =>
  new Response(body, { status, headers: { ...noStore, 'Content-Type': 'text/plain; charset=utf-8' } });

// next: deja pasar la request (en Vercel, `next` de @vercel/functions).
// env: función que devuelve la configuración (en Vercel, process.env).
export function createAcademyMiddleware(next, env, mode) {
  if (mode !== MODE_PANEL && mode !== MODE_SITE) throw new Error('modo de Academy inválido: ' + mode);

  return async function middleware(request) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);
    if (path === null) return text('Solicitud inválida', 400);
    const cfg = env();
    const lockdown = cfg.ACADEMY_LOCKDOWN === '1';

    if (mode === MODE_PANEL) {
      if (lockdown) return text('Academy en mantenimiento', 503);
      const session = await readIdentity(request, cfg, { kvGet: null });
      if (!session) return new Response(null, { status: 303, headers: { ...noStore, Location: LOGIN_PANEL } });
      if (session.role !== 'admin') return text('Acceso denegado', 403);
      return next({ headers: PRIVATE_HEADERS });
    }

    // MODE_SITE
    if (!protectedRule(path)) return next();
    const session = lockdown ? null : await readIdentity(request, cfg, { kvGet: null });
    const decision = decideProtected({ path, session, lockdown, adminHome: ADMIN_HOME });
    if (decision.action === 'maintenance') return text('Academy en mantenimiento', 503);
    if (decision.action === 'redirect') {
      return new Response(null, { status: 302, headers: { ...noStore, Location: decision.location } });
    }
    if (decision.action === 'deny') return text('Acceso denegado', 403);
    return next({ headers: PRIVATE_HEADERS });
  };
}
