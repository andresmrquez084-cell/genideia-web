// Recorrido completo Cloudflare → Vercel con cuentas y datos SINTÉTICOS.
// Login en Cloudflare (genideiacompany.com) → cookie → autorización en Vercel
// (academy.genideiacompany.com). Ambos entornos tienen la misma configuración.
// Ejecutar: npm test
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';
import { createAcademyMiddleware } from '../lib/academy-vercel.mjs';

const SECRET = 'secreto-sintetico-de-prueba-0123456789abcdef';
const PRIVATE = 'CONTENIDO-PRIVADO-SINTETICO';

const users = (over = {}) => ({
  'admin-test': { password: 'clave-admin-test', role: 'admin', ...over['admin-test'] },
  'alumno-a': { password: 'clave-a-test', role: 'student', slug: 'alumno-a', ...over['alumno-a'] },
  'alumno-b': { password: 'clave-b-test', role: 'student', slug: 'alumno-b', ...over['alumno-b'] },
});

// Dos entornos con configuración sincronizable. `cf` y `vercel` pueden divergir
// para simular la ventana entre cambiar una variable y que el otro entorno la reciba.
function world(usersOver = {}) {
  const base = { ACADEMY_SESSION_SECRET: SECRET, ACADEMY_USERS_JSON: JSON.stringify(users(usersOver)) };
  return { cf: { ...base }, vercel: { ...base } };
}

const enc = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function sign(secret, data) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return enc(new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))));
}
async function forgeCookie(payload, secret = SECRET) {
  const body = enc(new TextEncoder().encode(JSON.stringify(payload)));
  return `genideia_academy=${body}.${await sign(secret, body)}`;
}

const okNext = async () => new Response(`<html>${PRIVATE}</html>`, { status: 200, headers: { 'Content-Type': 'text/html' } });

async function cloudflare(env, path, { method = 'GET', cookie, form } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  let body;
  if (form) {
    body = new URLSearchParams(form);
    headers.set('content-type', 'application/x-www-form-urlencoded');
  }
  const request = new Request(`https://genideiacompany.com${path}`, { method, headers, body, redirect: 'manual' });
  const res = await onRequest({ request, next: okNext, env });
  return summarize(res);
}

async function vercel(env, path, { host = 'academy.genideiacompany.com', cookie } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  const request = new Request(`https://${host}${path}`, { headers, redirect: 'manual' });
  const handler = createAcademyMiddleware(okNext, () => env);
  return summarize(await handler(request));
}

async function summarize(res) {
  return {
    status: res.status,
    location: res.headers.get('location'),
    setCookie: res.headers.get('set-cookie'),
    body: await res.text(),
  };
}
const leaks = (r) => r.body.includes(PRIVATE);
const cookieFrom = (r) => r.setCookie.split(';')[0];

describe('recorrido: login en Cloudflare → autorización en Vercel', () => {
  test('admin entra en Cloudflare y su cookie abre el panel en Vercel', async () => {
    const w = world();
    const login = await cloudflare(w.cf, '/academy/acceso', { method: 'POST', form: { username: 'admin-test', password: 'clave-admin-test' } });
    assert.equal(login.status, 303);
    assert.equal(login.location, 'https://academy.genideiacompany.com/');
    assert.match(login.setCookie, /Domain=\.genideiacompany\.com/);
    assert.match(login.setCookie, /HttpOnly/);
    assert.match(login.setCookie, /Secure/);

    const panel = await vercel(w.vercel, '/', { cookie: cookieFrom(login) });
    assert.equal(panel.status, 200);
    assert.ok(leaks(panel), 'el panel debe servirse con sesión de admin');
    assert.equal(panel.body.includes(PRIVATE), true);
  });

  test('alumno: su cookie no abre el panel en Vercel, pero sí su plan en Cloudflare', async () => {
    const w = world();
    const login = await cloudflare(w.cf, '/academy/acceso', { method: 'POST', form: { username: 'alumno-a', password: 'clave-a-test' } });
    assert.equal(login.location, '/academy/alumnos/alumno-a');

    const panel = await vercel(w.vercel, '/', { cookie: cookieFrom(login) });
    assert.equal(panel.status, 303);
    assert.equal(leaks(panel), false);

    const own = await cloudflare(w.cf, '/academy/alumnos/alumno-a/', { cookie: cookieFrom(login) });
    assert.equal(own.status, 200);
    const other = await cloudflare(w.cf, '/academy/alumnos/alumno-b/', { cookie: cookieFrom(login) });
    assert.equal(other.status, 302);
    assert.equal(leaks(other), false);
  });

  test('sin cookie: Vercel no sirve el panel ni Cloudflare los planes', async () => {
    const w = world();
    const panel = await vercel(w.vercel, '/');
    assert.equal(panel.status, 303);
    assert.match(panel.location, /genideiacompany\.com\/academy\/acceso/);
    assert.equal(leaks(panel), false);
    const plan = await cloudflare(w.cf, '/academy/alumnos/alumno-a/');
    assert.equal(plan.status, 302);
    assert.equal(leaks(plan), false);
  });
});

describe('degradación y baja bloquean ambos entornos', () => {
  test('admin degradado a alumno: pierde el panel en Vercel y /sesiones en Cloudflare', async () => {
    const w = world();
    const login = await cloudflare(w.cf, '/academy/acceso', { method: 'POST', form: { username: 'admin-test', password: 'clave-admin-test' } });
    const cookie = cookieFrom(login);
    const degraded = JSON.stringify(users({ 'admin-test': { role: 'student', slug: 'admin-test' } }));
    w.cf.ACADEMY_USERS_JSON = degraded;
    w.vercel.ACADEMY_USERS_JSON = degraded;

    const panel = await vercel(w.vercel, '/', { cookie });
    assert.equal(panel.status, 303);
    assert.equal(leaks(panel), false);
    const sesiones = await cloudflare(w.cf, '/academy/sesiones/x/', { cookie });
    assert.equal(sesiones.status, 403);
    assert.equal(leaks(sesiones), false);
  });

  test('baja (disabled) de un alumno: bloquea su plan en Cloudflare', async () => {
    const w = world();
    const login = await cloudflare(w.cf, '/academy/acceso', { method: 'POST', form: { username: 'alumno-a', password: 'clave-a-test' } });
    const cookie = cookieFrom(login);
    const off = JSON.stringify(users({ 'alumno-a': { disabled: true } }));
    w.cf.ACADEMY_USERS_JSON = off;
    w.vercel.ACADEMY_USERS_JSON = off;
    const plan = await cloudflare(w.cf, '/academy/alumnos/alumno-a/', { cookie });
    assert.equal(plan.status, 302);
    assert.equal(leaks(plan), false);
  });

  test('baja con validAfter: los tokens emitidos antes dejan de valer en ambos', async () => {
    const w = world();
    const login = await cloudflare(w.cf, '/academy/acceso', { method: 'POST', form: { username: 'admin-test', password: 'clave-admin-test' } });
    const cookie = cookieFrom(login);
    const cut = JSON.stringify(users({ 'admin-test': { validAfter: new Date(Date.now() + 60_000).toISOString() } }));
    w.cf.ACADEMY_USERS_JSON = cut;
    w.vercel.ACADEMY_USERS_JSON = cut;
    // La sesión deja de valer: redirige al login en ambos (no llega a 403).
    assert.equal((await cloudflare(w.cf, '/academy/sesiones/x/', { cookie })).status, 302);
    assert.equal((await vercel(w.vercel, '/', { cookie })).status, 303);
  });

  test('ventana de propagación: si sólo Cloudflare recibió la baja, Vercel sigue aceptando hasta actualizarse', async () => {
    // Documenta el comportamiento real: la revocación no es instantánea entre entornos.
    const w = world();
    const login = await cloudflare(w.cf, '/academy/acceso', { method: 'POST', form: { username: 'admin-test', password: 'clave-admin-test' } });
    const cookie = cookieFrom(login);
    w.cf.ACADEMY_USERS_JSON = JSON.stringify(users({ 'admin-test': { disabled: true } }));
    assert.equal((await cloudflare(w.cf, '/academy/sesiones/x/', { cookie })).status, 302);
    assert.equal((await vercel(w.vercel, '/', { cookie })).status, 200, 'Vercel aún sin la baja');
    w.vercel.ACADEMY_USERS_JSON = w.cf.ACADEMY_USERS_JSON;
    assert.equal((await vercel(w.vercel, '/', { cookie })).status, 303);
  });
});

describe('tokens que no deben aceptarse en ningún entorno', () => {
  test('token del formato anterior (role embebido, sin iat) se rechaza en ambos', async () => {
    const w = world();
    const old = await forgeCookie({ u: 'admin-test', role: 'admin', exp: Date.now() + 3600_000 });
    assert.equal((await cloudflare(w.cf, '/academy/sesiones/x/', { cookie: old })).status, 302);
    assert.equal((await vercel(w.vercel, '/', { cookie: old })).status, 303);
  });

  test('token firmado con otro secreto se rechaza en ambos', async () => {
    const w = world();
    const forged = await forgeCookie({ u: 'admin-test', iat: Date.now(), exp: Date.now() + 3600_000 }, 'otro-secreto-sintetico-0123456789abcdefgh');
    assert.equal((await cloudflare(w.cf, '/academy/sesiones/x/', { cookie: forged })).status, 302);
    assert.equal((await vercel(w.vercel, '/', { cookie: forged })).status, 303);
  });

  test('token con iat en el futuro se rechaza en ambos', async () => {
    const w = world();
    const future = await forgeCookie({ u: 'admin-test', iat: Date.now() + 3600_000, exp: Date.now() + 7200_000 });
    assert.equal((await cloudflare(w.cf, '/academy/sesiones/x/', { cookie: future })).status, 302);
    assert.equal((await vercel(w.vercel, '/', { cookie: future })).status, 303);
  });
});

describe('rutas codificadas, barras repetidas y lockdown en ambos entornos', () => {
  test('rutas codificadas y barras repetidas no exponen planes en ninguno', async () => {
    const w = world();
    const login = await cloudflare(w.cf, '/academy/acceso', { method: 'POST', form: { username: 'alumno-a', password: 'clave-a-test' } });
    const cookie = cookieFrom(login);
    for (const p of ['/%61cademy/alumnos/alumno-b/', '/academy/%61lumnos/alumno-b/', '//academy/alumnos/alumno-b/', '/academy//alumnos///alumno-b/', '/ACADEMY/Alumnos/alumno-b/', '/academy/alumnos/alumno-b/../alumno-b/']) {
      const r = await cloudflare(w.cf, p, { cookie });
      assert.notEqual(r.status, 200, p);
      assert.equal(leaks(r), false, p);
    }
  });

  test('secuencia de escape inválida devuelve 400 en ambos', async () => {
    const w = world();
    assert.equal((await cloudflare(w.cf, '/academy/%E0%A4%A/')).status, 400);
    assert.equal((await vercel(w.vercel, '/%E0%A4%A/')).status, 400);
  });

  test('lockdown cierra panel, planes y login en ambos entornos', async () => {
    const w = world();
    const login = await cloudflare(w.cf, '/academy/acceso', { method: 'POST', form: { username: 'admin-test', password: 'clave-admin-test' } });
    const cookie = cookieFrom(login);
    w.cf.ACADEMY_LOCKDOWN = '1';
    w.vercel.ACADEMY_LOCKDOWN = '1';
    assert.equal((await cloudflare(w.cf, '/academy/alumnos/alumno-a/', { cookie })).status, 503);
    assert.equal((await cloudflare(w.cf, '/academy/acceso', { method: 'POST', form: { username: 'admin-test', password: 'clave-admin-test' } })).status, 503);
    const panel = await vercel(w.vercel, '/', { cookie });
    assert.equal(panel.status, 503);
    assert.equal(leaks(panel), false);
  });
});

describe('Vercel: hosts y rutas estáticas privadas', () => {
  test('genideia-academy.vercel.app exige admin aunque la cookie no llegue por dominio', async () => {
    const w = world();
    const r = await vercel(w.vercel, '/', { host: 'genideia-academy.vercel.app' });
    assert.equal(r.status, 303);
    assert.equal(leaks(r), false);
  });

  test('archivos estáticos privados de /academy/data no se sirven sin sesión de admin', async () => {
    const w = world();
    const anon = await vercel(w.vercel, '/academy/data/planes.json', { host: 'genideiacompany.com' });
    assert.equal(anon.status, 302);
    assert.equal(leaks(anon), false);
    const login = await cloudflare(w.cf, '/academy/acceso', { method: 'POST', form: { username: 'alumno-a', password: 'clave-a-test' } });
    const student = await vercel(w.vercel, '/academy/data/planes.json', { host: 'genideiacompany.com', cookie: cookieFrom(login) });
    assert.equal(student.status, 403);
    assert.equal(leaks(student), false);
  });
});
