// Pruebas de acceso de Academy con cuentas y datos SINTÉTICOS.
// Ejecutar: npm test
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest, normalizePath } from '../functions/_middleware.js';

const SECRET = 'secreto-sintetico-de-prueba-0123456789abcdef';
const PAGE = 'CONTENIDO-PRIVADO-SINTETICO';

const baseUsers = () => ({
  'admin-test': { password: 'clave-admin-test', role: 'admin' },
  'alumno-a': { password: 'clave-a-test', role: 'student', slug: 'alumno-a' },
  'alumno-b': { password: 'clave-b-test', role: 'student', slug: 'alumno-b' },
});
const baseEnv = (over = {}) => ({
  ACADEMY_SESSION_SECRET: SECRET,
  ACADEMY_USERS_JSON: JSON.stringify(baseUsers()),
  ...over,
});

const enc = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function sign(secret, data) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return enc(new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))));
}
async function cookieFor(payload, secret = SECRET) {
  const body = enc(new TextEncoder().encode(JSON.stringify(payload)));
  return `genideia_academy=${body}.${await sign(secret, body)}`;
}
const fresh = (u) => ({ u, iat: Date.now(), exp: Date.now() + 3600_000 });

async function call(path, { method = 'GET', cookie, form, env = baseEnv(), host = 'genideiacompany.com' } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  const init = { method, headers, redirect: 'manual' };
  if (form) {
    init.body = new URLSearchParams(form);
    headers.set('content-type', 'application/x-www-form-urlencoded');
  }
  const request = new Request(`https://${host}${path}`, init);
  const next = async () => new Response(`<html>${PAGE}</html>`, { status: 200, headers: { 'Content-Type': 'text/html' } });
  const res = await onRequest({ request, next, env });
  const body = await res.text();
  return { status: res.status, location: res.headers.get('location'), setCookie: res.headers.get('set-cookie'), cache: res.headers.get('cache-control'), body };
}
const leaks = (r) => r.body.includes(PAGE);

describe('visitante sin sesión', () => {
  test('rutas privadas: redirigen al login y no devuelven contenido', async () => {
    for (const p of ['/academy/alumnos/alumno-a/', '/academy/sesiones/x/', '/academy/panel/', '/academy/data/x.json']) {
      const r = await call(p);
      assert.equal(r.status, 302, p);
      assert.ok(r.location.startsWith('/academy/acceso'), p);
      assert.equal(leaks(r), false, p);
    }
  });
  test('páginas comerciales siguen públicas', async () => {
    for (const p of ['/', '/academy/', '/academy/1a1/', '/academy/grupal/', '/academy/acceso/', '/empresa/']) {
      const r = await call(p);
      assert.equal(r.status, 200, p);
      assert.equal(leaks(r), true, p);
    }
  });
});

describe('permisos por alumno y admin', () => {
  test('alumno A ve su plan con caché privada', async () => {
    const r = await call('/academy/alumnos/alumno-a/', { cookie: await cookieFor(fresh('alumno-a')) });
    assert.equal(r.status, 200);
    assert.ok(leaks(r));
    assert.match(r.cache, /private/);
    assert.match(r.cache, /no-store/);
  });
  test('alumno A no ve el plan de B (ruta directa y variantes)', async () => {
    const c = await cookieFor(fresh('alumno-a'));
    for (const p of [
      '/academy/alumnos/alumno-b/',
      '/academy/alumnos/alumno-b',
      '/academy/alumnos/alumno-b/index.html',
      '/academy/alumnos/ALUMNO-B/',
      '/academy/alumnos/alumno-b/./',
      '/academy/alumnos/alumno-a/../alumno-b/',
      '/academy/alumnos/alumno-a/%2e%2e/alumno-b/',
      '/academy/alumnos/alumno-a/..%2falumno-b/',
      '//academy/alumnos/alumno-b/',
      '/%61cademy/alumnos/alumno-b/',
      '/academy/%61lumnos/alumno-b/',
      '/academy%2Falumnos%2Falumno-b/',
      '/academy/alumnos%2Falumno-b/',
    ]) {
      const r = await call(p, { cookie: c });
      assert.equal(leaks(r), false, p);
      assert.notEqual(r.status, 200, p);
    }
  });
  test('alumno no accede a sesiones, panel ni data (403)', async () => {
    const c = await cookieFor(fresh('alumno-a'));
    for (const p of ['/academy/sesiones/marcelo-m01/', '/academy/panel/', '/academy/data/public-plans.json']) {
      const r = await call(p, { cookie: c });
      assert.equal(r.status, 403, p);
      assert.equal(leaks(r), false, p);
    }
  });
  test('admin ve cualquier plan, sesiones y panel', async () => {
    const c = await cookieFor(fresh('admin-test'));
    for (const p of ['/academy/alumnos/alumno-b/', '/academy/sesiones/x/', '/academy/panel/']) {
      const r = await call(p, { cookie: c });
      assert.equal(r.status, 200, p);
      assert.ok(leaks(r), p);
    }
  });
  test('ruta malformada (%) se rechaza con 400 sin contenido', async () => {
    const r = await call('/academy/alumnos/%E0%A4%A/');
    assert.equal(r.status, 400);
    assert.equal(leaks(r), false);
  });
});

describe('sesión', () => {
  const priv = '/academy/alumnos/alumno-a/';
  test('sin cookie, cookie basura y firma alterada: sin datos', async () => {
    for (const cookie of ['genideia_academy=basura.basura', 'genideia_academy=', await cookieFor(fresh('alumno-a'), 'otro-secreto-distinto-0000000000000000')]) {
      const r = await call(priv, { cookie });
      assert.equal(leaks(r), false);
      assert.equal(r.status, 302);
    }
  });
  test('token con rol alterado (sin firma válida): sin datos', async () => {
    const forged = await cookieFor({ ...fresh('alumno-a'), role: 'admin' }, 'secreto-atacante-000000000000000000000');
    const r = await call('/academy/sesiones/x/', { cookie: forged });
    assert.equal(leaks(r), false);
  });
  test('sesión vencida: sin datos', async () => {
    const c = await cookieFor({ u: 'alumno-a', iat: Date.now() - 2e6, exp: Date.now() - 1000 });
    assert.equal(leaks(await call(priv, { cookie: c })), false);
  });
  test('sin ACADEMY_SESSION_SECRET (o corto): cierra todo lo privado', async () => {
    const c = await cookieFor(fresh('alumno-a'));
    for (const env of [baseEnv({ ACADEMY_SESSION_SECRET: '' }), baseEnv({ ACADEMY_SESSION_SECRET: 'corto' })]) {
      assert.equal(leaks(await call(priv, { cookie: c, env })), false);
    }
  });
  test('rotar el secreto invalida sesiones existentes', async () => {
    const c = await cookieFor(fresh('alumno-a'));
    const r = await call(priv, { cookie: c, env: baseEnv({ ACADEMY_SESSION_SECRET: 'nuevo-secreto-rotado-0000000000000000' }) });
    assert.equal(leaks(r), false);
  });
  test('login con clave incorrecta, usuario inexistente o clave de prototipo: sin cookie', async () => {
    for (const form of [
      { username: 'alumno-a', password: 'mal' },
      { username: 'no-existe', password: 'x' },
      { username: 'constructor', password: 'x' },
      { username: '__proto__', password: 'x' },
    ]) {
      const r = await call('/academy/acceso', { method: 'POST', form });
      assert.equal(r.setCookie, null, JSON.stringify(form));
      assert.match(r.location, /error=1/);
    }
  });
  test('login correcto: cookie HttpOnly/Secure/SameSite y redirección a su plan', async () => {
    const r = await call('/academy/acceso', { method: 'POST', form: { username: 'Alumno-A', password: 'clave-a-test' } });
    assert.equal(r.location, '/academy/alumnos/alumno-a');
    assert.match(r.setCookie, /HttpOnly/);
    assert.match(r.setCookie, /Secure/);
    assert.match(r.setCookie, /SameSite=Lax/);
    assert.match(r.setCookie, /Max-Age=604800/);
    const again = await call(priv, { cookie: r.setCookie.split(';')[0] });
    assert.equal(again.status, 200);
    assert.ok(leaks(again));
  });
  test('logout borra la cookie', async () => {
    const r = await call('/academy/logout', { cookie: await cookieFor(fresh('alumno-a')) });
    assert.match(r.setCookie, /Max-Age=0/);
  });
});

describe('bajas, cambios de permisos y revocación', () => {
  test('usuario eliminado de la configuración: su sesión deja de valer', async () => {
    const users = baseUsers();
    delete users['alumno-a'];
    const r = await call('/academy/alumnos/alumno-a/', { cookie: await cookieFor(fresh('alumno-a')), env: baseEnv({ ACADEMY_USERS_JSON: JSON.stringify(users) }) });
    assert.equal(leaks(r), false);
  });
  test('disabled: true bloquea sesión existente y login', async () => {
    const users = baseUsers();
    users['alumno-a'].disabled = true;
    const env = baseEnv({ ACADEMY_USERS_JSON: JSON.stringify(users) });
    assert.equal(leaks(await call('/academy/alumnos/alumno-a/', { cookie: await cookieFor(fresh('alumno-a')), env })), false);
    const login = await call('/academy/acceso', { method: 'POST', form: { username: 'alumno-a', password: 'clave-a-test' }, env });
    assert.equal(login.setCookie, null);
  });
  test('admin degradado a alumno pierde el panel de inmediato', async () => {
    const users = baseUsers();
    users['admin-test'].role = 'student';
    users['admin-test'].slug = 'alumno-a';
    const env = baseEnv({ ACADEMY_USERS_JSON: JSON.stringify(users) });
    const r = await call('/academy/panel/', { cookie: await cookieFor(fresh('admin-test')), env });
    assert.equal(r.status, 403);
    assert.equal(leaks(r), false);
  });
  test('cambio de slug: el alumno ya no accede a su plan anterior', async () => {
    const users = baseUsers();
    users['alumno-a'].slug = 'alumno-z';
    const env = baseEnv({ ACADEMY_USERS_JSON: JSON.stringify(users) });
    const c = await cookieFor(fresh('alumno-a'));
    const old = await call('/academy/alumnos/alumno-a/', { cookie: c, env });
    assert.equal(leaks(old), false);
    const mine = await call('/academy/alumnos/alumno-z/', { cookie: c, env });
    assert.equal(mine.status, 200);
  });
  test('validAfter posterior a la emisión invalida la sesión; anterior no', async () => {
    const c = await cookieFor(fresh('alumno-a'));
    const future = baseUsers();
    future['alumno-a'].validAfter = new Date(Date.now() + 60_000).toISOString();
    assert.equal(leaks(await call('/academy/alumnos/alumno-a/', { cookie: c, env: baseEnv({ ACADEMY_USERS_JSON: JSON.stringify(future) }) })), false);
    const past = baseUsers();
    past['alumno-a'].validAfter = new Date(Date.now() - 60_000).toISOString();
    assert.ok(leaks(await call('/academy/alumnos/alumno-a/', { cookie: c, env: baseEnv({ ACADEMY_USERS_JSON: JSON.stringify(past) }) })));
  });
  test('revocación instantánea por KV: revoke:<usuario> con marca posterior a la emisión', async () => {
    const c = await cookieFor(fresh('alumno-a'));
    const kvRevoked = { get: async (k) => (k === 'revoke:alumno-a' ? String(Date.now() + 1000) : null) };
    assert.equal(leaks(await call('/academy/alumnos/alumno-a/', { cookie: c, env: baseEnv({ ACADEMY_KV: kvRevoked }) })), false);
    const kvOther = { get: async (k) => (k === 'revoke:alumno-b' ? String(Date.now() + 1000) : null) };
    assert.ok(leaks(await call('/academy/alumnos/alumno-a/', { cookie: c, env: baseEnv({ ACADEMY_KV: kvOther }) })));
  });
  test('si KV falla, no se deja pasar (fail closed)', async () => {
    const kvDown = { get: async () => { throw new Error('kv caído'); } };
    const r = await call('/academy/alumnos/alumno-a/', { cookie: await cookieFor(fresh('alumno-a')), env: baseEnv({ ACADEMY_KV: kvDown }) });
    assert.equal(leaks(r), false);
  });
  test('lockdown: cierra rutas privadas y login aunque la sesión sea válida; deja públicas las comerciales', async () => {
    const env = baseEnv({ ACADEMY_LOCKDOWN: '1' });
    const c = await cookieFor(fresh('admin-test'));
    const r = await call('/academy/alumnos/alumno-a/', { cookie: c, env });
    assert.equal(r.status, 503);
    assert.equal(leaks(r), false);
    assert.equal((await call('/academy/acceso', { method: 'POST', form: { username: 'admin-test', password: 'clave-admin-test' }, env })).status, 503);
    assert.equal((await call('/academy/1a1/', { env })).status, 200);
  });
});

describe('rutas alternativas y normalización', () => {
  test('normalizePath decodifica, colapsa barras y resuelve segmentos', () => {
    assert.equal(normalizePath('/%61cademy//alumnos/./x/../y/'), '/academy/alumnos/y');
    assert.equal(normalizePath('/academy/alumnos%2Fx'), '/academy/alumnos/x');
    assert.equal(normalizePath('/'), '/');
    assert.equal(normalizePath('/%E0%A4%A'), null);
  });
  test('el mismo control aplica en cualquier host servido por este proyecto', async () => {
    for (const host of ['genideiacompany.com', 'www.genideiacompany.com', 'genideia-web.pages.dev', 'PREVIEW-ABC.genideia-web.pages.dev']) {
      const r = await call('/academy/alumnos/alumno-a/', { host });
      assert.equal(leaks(r), false, host);
    }
  });
});
