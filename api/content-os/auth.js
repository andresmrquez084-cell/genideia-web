import crypto from 'node:crypto';
import { createContentOsSession, verifyContentOsSession, setContentOsSessionCookie, clearContentOsSessionCookie } from './_session.js';

const DEFAULT_SUPABASE_URL = 'https://dbwuubabafzsinaokawe.supabase.co';

function supabaseKey() {
  return process.env.CONTENT_OS_SUPABASE_SECRET_KEY || process.env.CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY || null;
}

function supabaseHeaders() {
  const key = supabaseKey();
  if (!key) throw new Error('Missing CONTENT_OS_SUPABASE_SECRET_KEY');
  const headers = { apikey: key, Accept: 'application/json' };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function getCredential(username) {
  const base = process.env.CONTENT_OS_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const response = await fetch(`${base}/rest/v1/content_os_access?username=eq.${encodeURIComponent(username)}&active=eq.true&select=username,password_hash,salt&limit=1`, { headers: supabaseHeaders() });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${await response.text()}`);
  const rows = await response.json();
  return rows?.[0] || null;
}

function validPassword(password, row) {
  if (!row?.password_hash || !row?.salt || typeof password !== 'string') return false;
  const calculated = crypto.scryptSync(password, Buffer.from(row.salt, 'hex'), 64).toString('hex');
  const a = Buffer.from(calculated, 'hex');
  const b = Buffer.from(row.password_hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'GET') {
    const session = verifyContentOsSession(req);
    if (!session) return res.status(401).json({ ok: false, authenticated: false });
    return res.status(200).json({ ok: true, authenticated: true, user: session.u });
  }

  if (req.method === 'DELETE') {
    clearContentOsSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!username || !password) return res.status(400).json({ ok: false, error: 'Usuario y contraseña requeridos' });

    const row = await getCredential(username);
    if (!row || !validPassword(password, row)) {
      await new Promise(resolve => setTimeout(resolve, 350));
      return res.status(401).json({ ok: false, error: 'Credenciales incorrectas' });
    }

    const token = createContentOsSession(row.username);
    setContentOsSessionCookie(res, token);
    return res.status(200).json({ ok: true, authenticated: true, user: row.username });
  } catch (error) {
    console.error('content-os auth failed', error);
    return res.status(500).json({ ok: false, error: 'No se pudo validar el acceso' });
  }
}
