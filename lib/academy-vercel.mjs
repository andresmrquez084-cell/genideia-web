// Protección de Academy en Vercel. Usa el MISMO núcleo que Cloudflare
// (lib/academy-auth.mjs): mismo token, misma configuración de usuarios.
// Vercel no emite tokens: el login vive sólo en Cloudflare (genideiacompany.com).
//
// Hosts de panel (admin-only en TODAS sus rutas):
//   academy.genideiacompany.com   (dominio propio; la cookie llega porque es .genideiacompany.com)
//   genideia-academy.vercel.app   (sin cookie válida: siempre redirige al login)
// Resto de hosts servidos por este proyecto: sólo las rutas privadas de /academy/*.

import { decideProtected, normalizePath, protectedRule, readIdentity } from './academy-auth.mjs';

export const ADMIN_HOSTS = ['academy.genideiacompany.com', 'genideia-academy.vercel.app'];
const LOGIN_PANEL = 'https://genideiacompany.com/academy/acceso?next=panel';
const ADMIN_HOME = 'https://academy.genideiacompany.com/';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' };
const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

const text = (body, status) =>
  new Response(body, { status, headers: { ...noStore, 'Content-Type': 'text/plain; charset=utf-8' } });

// next: función que deja pasar la request (en Vercel, `next` de @vercel/functions).
// env: fuente de configuración (en Vercel, process.env).
export function createAcademyMiddleware(next, env) {
  return async function middleware(request) {
    const url = new URL(request.url);
    const host = (request.headers.get('host') || url.host).split(':')[0].toLowerCase();
    const path = normalizePath(url.pathname);
    if (path === null) return text('Solicitud inválida', 400);
    const cfg = env();
    const lockdown = cfg.ACADEMY_LOCKDOWN === '1';

    if (ADMIN_HOSTS.includes(host)) {
      if (lockdown) return text('Academy en mantenimiento', 503);
      const session = await readIdentity(request, cfg, { kvGet: null });
      if (!session || session.role !== 'admin') {
        return new Response(null, { status: 303, headers: { ...noStore, Location: LOGIN_PANEL } });
      }
      return next({ headers: PRIVATE_HEADERS });
    }

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
