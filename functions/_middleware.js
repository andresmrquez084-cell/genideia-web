// Protección de rutas privadas de Academy en Cloudflare Pages.
// Corre ANTES de servir cualquier archivo estático: sin sesión válida nunca se
// devuelve HTML ni datos privados.
//
// Variables (Cloudflare Pages → Settings → Environment variables):
//   ACADEMY_SESSION_SECRET  Secret, 32+ caracteres. Sin esto todo lo privado queda cerrado.
//   ACADEMY_USERS_JSON      Secret. {"usuario":{"password":"...","role":"admin"|"student","slug":"...","disabled":false,"validAfter":"2026-11-19T00:00:00Z"}}
//   ACADEMY_LOCKDOWN        "1" cierra todas las rutas privadas y el login (ver docs/academy-acceso.md).
// Binding opcional:
//   ACADEMY_KV              KV namespace. Clave "revoke:<usuario>" = timestamp en ms: invalida sesiones emitidas antes.
//
// La autorización (rol, slug, baja) se lee de la configuración ACTUAL en cada
// request; el token sólo prueba identidad y fecha de emisión.

const COOKIE = 'genideia_academy';
const LOGIN = '/academy/acceso';
const SESSION_DAYS = 7;
const DOMAIN = 'genideiacompany.com';

// Rutas privadas. Todo lo que no esté aquí es público (páginas comerciales, 1a1, grupal…).
const PROTECTED = [
  { prefix: '/academy/alumnos', rule: 'student' }, // plan de cada alumno: sólo dueño o admin
  { prefix: '/academy/sesiones', rule: 'admin' },
  { prefix: '/academy/panel', rule: 'admin' },
  { prefix: '/academy/data', rule: 'admin' },
];

const enc = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const dec = (s) => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};

async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return enc(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))));
}

// Comparación en tiempo constante.
function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function usersConfig(env) {
  try {
    const parsed = JSON.parse(env.ACADEMY_USERS_JSON || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function lookupUser(env, username) {
  const list = usersConfig(env);
  return Object.prototype.hasOwnProperty.call(list, username) ? list[username] : null;
}

function secretOk(env) {
  return typeof env.ACADEMY_SESSION_SECRET === 'string' && env.ACADEMY_SESSION_SECRET.length >= 32;
}

// Normaliza la ruta igual que la resolvería el servidor: decodifica, colapsa
// barras, resuelve "." y "..". Devuelve null si la ruta no se puede interpretar.
export function normalizePath(pathname) {
  let p = pathname;
  try {
    for (let i = 0; i < 5; i++) {
      const d = decodeURIComponent(p);
      if (d === p) break;
      p = d;
    }
  } catch {
    return null;
  }
  p = p.replace(/\\/g, '/').replace(/\/+/g, '/');
  const out = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return '/' + out.join('/');
}

async function makeToken(env, username, user) {
  const now = Date.now();
  const payload = { u: username, iat: now, exp: now + SESSION_DAYS * 86400000 };
  const body = enc(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await hmac(env.ACADEMY_SESSION_SECRET, body)}`;
}

// Devuelve la identidad ACTUAL del usuario, o null si la sesión no vale.
export async function readSession(request, env) {
  if (!secretOk(env)) return null;
  const cookies = request.headers.get('cookie') || '';
  const hit = cookies
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + '='));
  if (!hit) return null;
  const [body, sig] = hit.slice(COOKIE.length + 1).split('.');
  if (!body || !sig) return null;
  if (!safeEqual(await hmac(env.ACADEMY_SESSION_SECRET, body), sig)) return null;

  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(dec(body)));
  } catch {
    return null;
  }
  if (!data || typeof data.u !== 'string' || !data.iat || !data.exp || data.exp < Date.now()) return null;

  // Bajas y cambios de permisos: se consulta la configuración actual
  const user = lookupUser(env, data.u);
  if (!user || user.disabled === true) return null;
  if (user.role !== 'admin' && user.role !== 'student') return null;
  if (user.validAfter) {
    const t = Date.parse(user.validAfter);
    if (!Number.isNaN(t) && data.iat < t) return null;
  }
  if (env.ACADEMY_KV) {
    try {
      const rev = await env.ACADEMY_KV.get('revoke:' + data.u);
      if (rev && data.iat < Number(rev)) return null;
    } catch {
      return null; // si no podemos confirmar revocación, no dejamos pasar
    }
  }
  return { u: data.u, role: user.role, slug: user.slug };
}

function setCookieHeader(hostname, value, maxAge) {
  const domain = hostname === DOMAIN || hostname.endsWith('.' + DOMAIN) ? `; Domain=.${DOMAIN}` : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}${domain}`;
}

const noStore = (extra = {}) => ({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...extra });

function home(session) {
  if (session.role === 'admin') return 'https://academy.genideiacompany.com/';
  return `/academy/alumnos/${session.slug}`;
}

// Comparación sin distinguir mayúsculas: no dejamos escapar rutas por casing.
function protectedRule(path) {
  const lower = path.toLowerCase();
  return PROTECTED.find((p) => lower === p.prefix || lower.startsWith(p.prefix + '/')) || null;
}

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  const path = normalizePath(url.pathname);
  if (path === null) {
    return new Response('Solicitud inválida', { status: 400, headers: noStore({ 'Content-Type': 'text/plain; charset=utf-8' }) });
  }

  if (path === '/academy/logout') {
    return new Response(null, { status: 303, headers: noStore({ Location: LOGIN, 'Set-Cookie': setCookieHeader(url.hostname, '', 0) }) });
  }

  const lockdown = env.ACADEMY_LOCKDOWN === '1';
  const session = lockdown ? null : await readSession(request, env);

  if (path === LOGIN) {
    if (lockdown) {
      return new Response('Academy en mantenimiento', { status: 503, headers: noStore({ 'Content-Type': 'text/plain; charset=utf-8' }) });
    }
    if (request.method === 'POST') {
      if (!secretOk(env)) {
        return new Response(null, { status: 303, headers: noStore({ Location: `${LOGIN}?error=1` }) });
      }
      const form = await request.formData();
      const username = String(form.get('username') || '').trim().toLowerCase();
      const password = String(form.get('password') || '');
      const user = lookupUser(env, username);
      const ok = !!user && user.disabled !== true && typeof user.password === 'string' && safeEqual(user.password, password);
      if (!ok) {
        return new Response(null, { status: 303, headers: noStore({ Location: `${LOGIN}?error=1` }) });
      }
      const token = await makeToken(env, username, user);
      const dest = user.role === 'admin' ? 'https://academy.genideiacompany.com/' : `/academy/alumnos/${user.slug}`;
      return new Response(null, {
        status: 303,
        headers: noStore({ Location: dest, 'Set-Cookie': setCookieHeader(url.hostname, token, SESSION_DAYS * 86400) }),
      });
    }
    if (session) return new Response(null, { status: 303, headers: noStore({ Location: home(session) }) });
    return next();
  }

  const rule = protectedRule(path);
  if (!rule) return next(); // páginas comerciales y estáticas públicas

  if (lockdown) {
    return new Response('Academy en mantenimiento', { status: 503, headers: noStore({ 'Content-Type': 'text/plain; charset=utf-8' }) });
  }

  // Sin sesión válida: sólo redirección, nunca HTML ni datos
  if (!session) {
    return new Response(null, { status: 302, headers: noStore({ Location: `${LOGIN}?next=${encodeURIComponent(path)}` }) });
  }

  if (rule.rule === 'admin' && session.role !== 'admin') {
    return new Response('Acceso denegado', { status: 403, headers: noStore({ 'Content-Type': 'text/plain; charset=utf-8' }) });
  }

  if (rule.rule === 'student' && session.role !== 'admin') {
    const wanted = (path.split('/')[3] || '').toLowerCase();
    if (!session.slug || wanted !== String(session.slug).toLowerCase()) {
      return new Response(null, { status: 302, headers: noStore({ Location: home(session) }) });
    }
  }

  const res = await next();
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Vary', 'Cookie');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
