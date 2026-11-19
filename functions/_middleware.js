// Protección de rutas privadas de Academy en Cloudflare Pages.
// Corre ANTES de servir cualquier archivo estático: si no hay sesión válida,
// nunca se devuelve el HTML ni los datos privados.
//
// Variables de entorno (Cloudflare Pages → Settings → Environment variables, tipo Secret):
//   ACADEMY_SESSION_SECRET  secreto HMAC (≥ 32 caracteres). Sin esto, todo lo privado queda cerrado.
//   ACADEMY_USERS_JSON      {"usuario":{"password":"...","role":"admin"|"student","slug":"..."}}
//
// Compatible con la cookie que emite academy/middleware.ts (Vercel) para que
// academy.genideiacompany.com y genideiacompany.com compartan sesión.

const COOKIE = 'genideia_academy';
const LOGIN = '/academy/acceso';
const SESSION_DAYS = 30;
const DOMAIN = 'genideiacompany.com';

// Rutas privadas. Todo lo que no esté aquí es público (páginas comerciales, 1a1, grupal, etc.).
const PROTECTED = [
  { prefix: '/academy/alumnos', rule: 'student' }, // plan de cada alumno: sólo su dueño o admin
  { prefix: '/academy/sesiones', rule: 'admin' }, // registros de sesiones: sólo admin
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
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return enc(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))));
}

// Comparación en tiempo constante para firmas y contraseñas.
function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function users(env) {
  try {
    const parsed = JSON.parse(env.ACADEMY_USERS_JSON || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function makeToken(env, username, user) {
  const payload = {
    u: username,
    role: user.role,
    slug: user.slug,
    exp: Date.now() + SESSION_DAYS * 86400000,
  };
  const body = enc(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await hmac(env.ACADEMY_SESSION_SECRET, body)}`;
}

async function readSession(request, env) {
  const secret = env.ACADEMY_SESSION_SECRET || '';
  if (secret.length < 32) return null; // fail closed
  const cookies = request.headers.get('cookie') || '';
  const hit = cookies
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + '='));
  if (!hit) return null;
  const token = hit.slice(COOKIE.length + 1);
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  if (!safeEqual(await hmac(secret, body), sig)) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(dec(body)));
    if (!data.exp || data.exp < Date.now()) return null;
    if (data.role !== 'admin' && data.role !== 'student') return null;
    return data;
  } catch {
    return null;
  }
}

function setCookieHeader(hostname, value, maxAge) {
  // Domain compartido sólo en el dominio real; en previews de Pages queda host-only.
  const domain = hostname === DOMAIN || hostname.endsWith('.' + DOMAIN) ? `; Domain=.${DOMAIN}` : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}${domain}`;
}

function noStore(extra = {}) {
  return { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...extra };
}

function home(session) {
  if (session.role === 'admin') return 'https://academy.genideiacompany.com/';
  return `/academy/alumnos/${session.slug}`;
}

function protectedRule(path) {
  return PROTECTED.find((p) => path === p.prefix || path.startsWith(p.prefix + '/')) || null;
}

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  const session = await readSession(request, env);

  // Cierre de sesión
  if (path === '/academy/logout') {
    return new Response(null, {
      status: 303,
      headers: noStore({ Location: LOGIN, 'Set-Cookie': setCookieHeader(url.hostname, '', 0) }),
    });
  }

  // Login: POST verifica credenciales, GET redirige si ya hay sesión
  if (path === LOGIN) {
    if (request.method === 'POST') {
      const form = await request.formData();
      const username = String(form.get('username') || '').trim().toLowerCase();
      const password = String(form.get('password') || '');
      const list = users(env);
      const user = Object.prototype.hasOwnProperty.call(list, username) ? list[username] : null;
      const ok = user && typeof user.password === 'string' && safeEqual(user.password, password);
      if (!ok || !env.ACADEMY_SESSION_SECRET || env.ACADEMY_SESSION_SECRET.length < 32) {
        return new Response(null, { status: 303, headers: noStore({ Location: `${LOGIN}?error=1` }) });
      }
      const token = await makeToken(env, username, user);
      const dest = user.role === 'admin' ? 'https://academy.genideiacompany.com/' : `/academy/alumnos/${user.slug}`;
      return new Response(null, {
        status: 303,
        headers: noStore({ Location: dest, 'Set-Cookie': setCookieHeader(url.hostname, token, SESSION_DAYS * 86400) }),
      });
    }
    if (session) {
      return new Response(null, { status: 303, headers: noStore({ Location: home(session) }) });
    }
    return next();
  }

  const rule = protectedRule(path);
  if (!rule) return next(); // páginas comerciales y estáticas públicas

  // Sin sesión válida: nada de HTML ni datos, sólo redirección al login
  if (!session) {
    const next_ = encodeURIComponent(path);
    return new Response(null, { status: 302, headers: noStore({ Location: `${LOGIN}?next=${next_}` }) });
  }

  if (rule.rule === 'admin' && session.role !== 'admin') {
    return new Response('Acceso denegado', { status: 403, headers: noStore({ 'Content-Type': 'text/plain; charset=utf-8' }) });
  }

  if (rule.rule === 'student' && session.role !== 'admin') {
    const wanted = path.split('/')[3] || '';
    if (!session.slug || wanted !== session.slug) {
      // Un alumno nunca ve el plan de otro: se lo devolvemos a su propio plan
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
