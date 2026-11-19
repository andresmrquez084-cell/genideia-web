// Proyecto de Vercel dedicado al panel (modo panel). Datos SINTÉTICOS.
// Toda ruta y todo host exigen admin: dominios de deployment no enumerados,
// aliases nuevos, archivos directos (/index.html, /data/public-plans.json).
// Ejecutar: npm test
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createAcademyMiddleware, MODE_PANEL, MODE_SITE } from '../lib/academy-vercel.mjs';

const SECRET = 'secreto-sintetico-de-prueba-0123456789abcdef';
const PANEL = 'CONTENIDO-PANEL-SINTETICO';
const users = () => ({
  'admin-test': { password: 'clave-admin-test', role: 'admin' },
  'alumno-a': { password: 'clave-a-test', role: 'student', slug: 'alumno-a' },
});
const baseEnv = () => ({ ACADEMY_SESSION_SECRET: SECRET, ACADEMY_USERS_JSON: JSON.stringify(users()) });

const enc = (bytes) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function sign(secret, data) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return enc(new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data))));
}
// Token válido con el formato de Cloudflare (login real).
async function tokenFor(u) {
  const body = enc(new TextEncoder().encode(JSON.stringify({ u, iat: Date.now(), exp: Date.now() + 3600_000 })));
  return `genideia_academy=${body}.${await sign(SECRET, body)}`;
}
const okNext = async () => new Response(`<html>${PANEL}</html>`, { status: 200, headers: { 'Content-Type': 'text/html' } });

async function panel(env, path, { host = 'proyecto-panel.vercel.app', cookie, method = 'GET' } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  const request = new Request(`https://${host}${path}`, { method, headers, redirect: 'manual' });
  const res = await createAcademyMiddleware(okNext, () => env, MODE_PANEL)(request);
  return { status: res.status, location: res.headers.get('location'), body: await res.text() };
}
const leaks = (r) => r.body.includes(PANEL);

describe('panel: toda ruta y todo host exigen admin', () => {
  test('dominio de deployment no enumerado: sin sesión no devuelve contenido', async () => {
    for (const p of ['/', '/index.html', '/data/public-plans.json', '/assets/x.js']) {
      const r = await panel(baseEnv(), p, { host: 'proyecto-panel-abc123-equipo.vercel.app' });
      assert.equal(r.status, 303, p);
      assert.equal(leaks(r), false, p);
      assert.match(r.location, /genideiacompany\.com\/academy\/acceso/);
    }
  });

  test('alias nuevo cualquiera: mismo control, sin depender del nombre del host', async () => {
    const r = await panel(baseEnv(), '/', { host: 'paneles-futuro.ejemplo.com' });
    assert.equal(r.status, 303);
    assert.equal(leaks(r), false);
  });

  test('acceso directo a /index.html y /data/public-plans.json sin sesión: nada se sirve', async () => {
    for (const p of ['/index.html', '/data/public-plans.json']) {
      const r = await panel(baseEnv(), p);
      assert.equal(r.status, 303, p);
      assert.equal(leaks(r), false, p);
    }
  });

  test('admin válido entra en cualquier host y ruta', async () => {
    const cookie = await tokenFor('admin-test');
    for (const [host, p] of [['proyecto-panel.vercel.app', '/'], ['paneles-futuro.ejemplo.com', '/index.html'], ['proyecto-panel-abc123.vercel.app', '/data/public-plans.json']]) {
      const r = await panel(baseEnv(), p, { host, cookie });
      assert.equal(r.status, 200, host + p);
      assert.ok(leaks(r), host + p);
    }
  });

  test('alumno válido es rechazado (403) en cualquier ruta y host', async () => {
    const cookie = await tokenFor('alumno-a');
    for (const [host, p] of [['proyecto-panel.vercel.app', '/'], ['paneles-futuro.ejemplo.com', '/index.html'], ['proyecto-panel-abc123.vercel.app', '/data/public-plans.json']]) {
      const r = await panel(baseEnv(), p, { host, cookie });
      assert.equal(r.status, 403, host + p);
      assert.equal(leaks(r), false, host + p);
    }
  });

  test('token con firma ajena o sin cookie: no pasa', async () => {
    const body = enc(new TextEncoder().encode(JSON.stringify({ u: 'admin-test', iat: Date.now(), exp: Date.now() + 3600_000 })));
    const forged = `genideia_academy=${body}.${await sign('otro-secreto-sintetico-0123456789abcdefgh', body)}`;
    assert.equal((await panel(baseEnv(), '/', { cookie: forged })).status, 303);
    assert.equal(leaks(await panel(baseEnv(), '/', { cookie: forged })), false);
  });

  test('lockdown: 503 en todas las rutas y hosts, también con admin válido', async () => {
    const cookie = await tokenFor('admin-test');
    const env = { ...baseEnv(), ACADEMY_LOCKDOWN: '1' };
    for (const [host, p] of [['proyecto-panel.vercel.app', '/'], ['paneles-futuro.ejemplo.com', '/index.html'], ['proyecto-panel-abc123.vercel.app', '/data/public-plans.json']]) {
      const r = await panel(env, p, { host, cookie });
      assert.equal(r.status, 503, host + p);
      assert.equal(leaks(r), false, host + p);
    }
  });

  test('rutas codificadas y barras repetidas siguen exigiendo admin', async () => {
    for (const p of ['/%69ndex.html', '//index.html', '/./index.html', '/%2e%2e/index.html']) {
      const r = await panel(baseEnv(), p);
      assert.equal(leaks(r), false, p);
      assert.notEqual(r.status, 200, p);
    }
  });
});

describe('sitio comercial: el modo sitio sigue siendo público fuera de /academy privado', () => {
  test('página comercial responde sin sesión en cualquier host', async () => {
    const site = createAcademyMiddleware(okNext, () => baseEnv(), MODE_SITE);
    const req = new Request('https://genideiacompany.com/academy/', { redirect: 'manual' });
    const r = await site(req);
    assert.equal(r.status, 200);
  });

  test('modo inválido lanza error (no hay modo por defecto)', () => {
    assert.throws(() => createAcademyMiddleware(okNext, () => ({}), 'otro'));
  });
});
