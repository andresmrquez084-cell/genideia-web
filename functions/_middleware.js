// Protección de rutas privadas de Academy en Cloudflare Pages.
// Corre ANTES de servir cualquier archivo estático: sin sesión válida nunca se
// devuelve HTML ni datos privados. La lógica de token y permisos vive en
// lib/academy-auth.mjs, compartida con Vercel.
//
// Variables (Cloudflare Pages → Settings → Environment variables):
//   ACADEMY_SESSION_SECRET  Secret, 32+ caracteres. Sin esto todo lo privado queda cerrado.
//   ACADEMY_USERS_JSON      Secret. Mismo valor que en Vercel (ver docs/academy-acceso.md).
//   ACADEMY_LOCKDOWN        "1" cierra todas las rutas privadas y el login.
// Binding opcional:
//   ACADEMY_KV              KV. Clave "revoke:<usuario>" = ms. Consistencia EVENTUAL (ver runbook).

import {
  COOKIE,
  LOGIN,
  decideProtected,
  protectedRule,
  makeToken,
  normalizePath,
  readIdentity,
  secretOk,
  lookupUser,
  safeEqual,
  setCookieHeader,
  SESSION_DAYS,
} from '../lib/academy-auth.mjs';

export { normalizePath };

const ADMIN_HOME = 'https://academy.genideiacompany.com/';
const noStore = (extra = {}) => ({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...extra });
const text = (body, status) => new Response(body, { status, headers: noStore({ 'Content-Type': 'text/plain; charset=utf-8' }) });

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  const path = normalizePath(url.pathname);
  if (path === null) return text('Solicitud inválida', 400);

  if (path === '/academy/logout') {
    return new Response(null, { status: 303, headers: noStore({ Location: LOGIN, 'Set-Cookie': setCookieHeader(url.hostname, '', 0) }) });
  }

  const lockdown = env.ACADEMY_LOCKDOWN === '1';
  const kvGet = env.ACADEMY_KV ? (k) => env.ACADEMY_KV.get(k) : null;

  if (path === LOGIN) {
    if (lockdown) return text('Academy en mantenimiento', 503);
    if (request.method === 'POST') {
      if (!secretOk(env)) return new Response(null, { status: 303, headers: noStore({ Location: `${LOGIN}?error=1` }) });
      const form = await request.formData();
      const username = String(form.get('username') || '').trim().toLowerCase();
      const password = String(form.get('password') || '');
      const user = lookupUser(env, username);
      const ok = !!user && user.disabled !== true && typeof user.password === 'string' && safeEqual(user.password, password);
      if (!ok) return new Response(null, { status: 303, headers: noStore({ Location: `${LOGIN}?error=1` }) });
      const token = await makeToken(env.ACADEMY_SESSION_SECRET, username);
      const dest = user.role === 'admin' ? ADMIN_HOME : `/academy/alumnos/${user.slug}`;
      return new Response(null, {
        status: 303,
        headers: noStore({ Location: dest, 'Set-Cookie': setCookieHeader(url.hostname, token, SESSION_DAYS * 86400) }),
      });
    }
    const session = lockdown ? null : await readIdentity(request, env, { kvGet });
    if (session) return new Response(null, { status: 303, headers: noStore({ Location: session.role === 'admin' ? ADMIN_HOME : `/academy/alumnos/${session.slug}` }) });
    return next();
  }

  // Páginas públicas: no se tocan.
  if (!protectedRule(path)) return next();

  const session = lockdown ? null : await readIdentity(request, env, { kvGet });
  const decision = decideProtected({ path, session, lockdown, adminHome: ADMIN_HOME });

  if (decision.action === 'maintenance') return text('Academy en mantenimiento', 503);
  if (decision.action === 'redirect') return new Response(null, { status: 302, headers: noStore({ Location: decision.location }) });
  if (decision.action === 'deny') return text('Acceso denegado', 403);

  const res = await next();
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Vary', 'Cookie');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
