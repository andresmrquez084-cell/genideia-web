// Núcleo de autenticación de Academy, compartido por Cloudflare Pages
// (functions/_middleware.js) y Vercel (middleware.ts / academy/middleware.ts).
// Ambos entornos deben producir y validar EXACTAMENTE el mismo token, y deben
// leer la misma configuración (ACADEMY_SESSION_SECRET y ACADEMY_USERS_JSON).
//
// Token: base64url(JSON {u, iat, exp}) + "." + HMAC-SHA256.
// La identidad (rol, slug, baja, validAfter) se lee de la configuración ACTUAL
// en cada request. El token sólo prueba usuario y fecha de emisión.

export const COOKIE = 'genideia_academy';
export const LOGIN = '/academy/acceso';
export const SESSION_DAYS = 7;
export const COOKIE_DOMAIN = 'genideiacompany.com';
const DAY_MS = 86400000;
const CLOCK_SKEW_MS = 60000;

// Rutas privadas. Todo lo que no esté aquí es público.
export const PROTECTED = [
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
export function safeEqual(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function secretOk(env) {
  return typeof env.ACADEMY_SESSION_SECRET === 'string' && env.ACADEMY_SESSION_SECRET.length >= 32;
}

// Parsea ACADEMY_USERS_JSON. Devuelve {} si no es un objeto válido.
export function usersConfig(env) {
  try {
    const parsed = JSON.parse(env.ACADEMY_USERS_JSON || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function lookupUser(env, username) {
  const list = usersConfig(env);
  return Object.prototype.hasOwnProperty.call(list, username) ? list[username] : null;
}

// Normaliza la ruta igual que la resolvería el servidor: decodifica, colapsa
// barras, resuelve "." y "..". Devuelve null si no se puede interpretar.
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

// Comparación sin distinguir mayúsculas.
export function protectedRule(path) {
  const lower = path.toLowerCase();
  return PROTECTED.find((p) => lower === p.prefix || lower.startsWith(p.prefix + '/')) || null;
}

// Emite un token firmado para un usuario. Sólo se llama desde el login.
export async function makeToken(secret, username, now = Date.now()) {
  const payload = { u: username, iat: now, exp: now + SESSION_DAYS * DAY_MS };
  const body = enc(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await hmac(secret, body)}`;
}

// Valida firma, formato y vencimiento. NO valida permisos.
export async function verifyToken(secret, token, now = Date.now()) {
  if (!secret || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  if (!safeEqual(await hmac(secret, body), sig)) return null;
  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(dec(body)));
  } catch {
    return null;
  }
  if (!data || typeof data.u !== 'string' || typeof data.iat !== 'number' || typeof data.exp !== 'number') return null;
  if (data.exp < now) return null;
  if (data.iat > now + CLOCK_SKEW_MS) return null; // emitido en el futuro: no válido
  return { u: data.u, iat: data.iat, exp: data.exp };
}

// Devuelve la identidad ACTUAL del usuario del token, o null.
// revokedAt: timestamp (ms) de revocación para el usuario, o null. Lo aporta el
// llamador (Cloudflare KV). Cualquier duda sobre revocación = null.
export function currentIdentity(env, payload, { revokedAt = null, now = Date.now() } = {}) {
  const user = lookupUser(env, payload.u);
  if (!user || typeof user !== 'object') return null;
  if (user.disabled === true) return null;
  if (user.role !== 'admin' && user.role !== 'student') return null;
  if (user.validAfter) {
    const t = Date.parse(user.validAfter);
    if (!Number.isNaN(t) && payload.iat < t) return null;
  }
  if (revokedAt !== null && payload.iat < Number(revokedAt)) return null;
  if (now > 0 && payload.exp < now) return null;
  return { u: payload.u, role: user.role, slug: typeof user.slug === 'string' ? user.slug : null };
}

// Lee la cookie de la request y devuelve la identidad actual, o null.
// kvGet(clave) es opcional (Cloudflare KV). Si falla, no se deja pasar.
export async function readIdentity(request, env, { kvGet = null, now = Date.now() } = {}) {
  if (!secretOk(env)) return null;
  const cookies = request.headers.get('cookie') || '';
  const hit = cookies
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + '='));
  if (!hit) return null;
  const payload = await verifyToken(env.ACADEMY_SESSION_SECRET, hit.slice(COOKIE.length + 1), now);
  if (!payload) return null;
  let revokedAt = null;
  if (kvGet) {
    try {
      revokedAt = await kvGet('revoke:' + payload.u);
    } catch {
      return null;
    }
  }
  return currentIdentity(env, payload, { revokedAt, now });
}

export function homeFor(session, adminHome) {
  if (session.role === 'admin') return adminHome;
  return `/academy/alumnos/${session.slug}`;
}

// Decide qué hacer con una ruta privada. Sólo se usa si protectedRule(path) existe.
// Devuelve {action:'next'} | {action:'redirect', location} | {action:'deny'} | {action:'maintenance'}
export function decideProtected({ path, session, lockdown, adminHome }) {
  const rule = protectedRule(path);
  if (!rule) return { action: 'next' };
  if (lockdown) return { action: 'maintenance' };
  if (!session) return { action: 'redirect', location: `${LOGIN}?next=${encodeURIComponent(path)}` };
  if (rule.rule === 'admin' && session.role !== 'admin') return { action: 'deny' };
  if (rule.rule === 'student' && session.role !== 'admin') {
    const wanted = (path.split('/')[3] || '').toLowerCase();
    if (!session.slug || wanted !== String(session.slug).toLowerCase()) {
      return { action: 'redirect', location: homeFor(session, adminHome) };
    }
  }
  return { action: 'next' };
}

export function setCookieHeader(hostname, value, maxAge) {
  const domain = hostname === COOKIE_DOMAIN || hostname.endsWith('.' + COOKIE_DOMAIN) ? `; Domain=.${COOKIE_DOMAIN}` : '';
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}${domain}`;
}
