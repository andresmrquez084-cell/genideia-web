import crypto from 'node:crypto';

const COOKIE_NAME = 'content_os_session';
const MAX_AGE_SECONDS = 8 * 60 * 60;

function secret() {
  const value = process.env.CONTENT_OS_SYNC_SECRET;
  if (!value) throw new Error('Missing CONTENT_OS_SYNC_SECRET');
  return value;
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createContentOsSession(username) {
  const payload = b64url(JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS }));
  return `${payload}.${sign(payload)}`;
}

export function verifyContentOsSession(req) {
  const cookieHeader = req.headers?.cookie || '';
  const cookies = Object.fromEntries(cookieHeader.split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('=');
    return i === -1 ? [v, ''] : [v.slice(0, i), v.slice(i + 1)];
  }));
  const token = cookies[COOKIE_NAME];
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.u || !data?.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export function setContentOsSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}`);
}

export function clearContentOsSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
}
