import crypto from 'node:crypto';

const DEFAULT_SUPABASE_URL = 'https://dbwuubabafzsinaokawe.supabase.co';

function supabaseKey() {
  return process.env.CONTENT_OS_SUPABASE_SECRET_KEY || process.env.CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY || null;
}

function supabaseHeaders(extra = {}) {
  const key = supabaseKey();
  if (!key) throw new Error('Missing CONTENT_OS_SUPABASE_SECRET_KEY');
  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
    ...extra,
  };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export async function sb(path, options = {}) {
  const base = process.env.CONTENT_OS_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...supabaseHeaders(),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function credentialKey() {
  const syncSecret = process.env.CONTENT_OS_SYNC_SECRET;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!syncSecret || !appSecret) throw new Error('Missing credential encryption inputs');
  return crypto
    .createHash('sha256')
    .update(`genideia-content-os/meta/v1:${syncSecret}:${appSecret}`)
    .digest();
}

export function encryptAccessToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', credentialKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    token_ciphertext: ciphertext.toString('base64'),
    token_iv: iv.toString('base64'),
    token_tag: tag.toString('base64'),
  };
}

export function decryptAccessToken(row) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    credentialKey(),
    Buffer.from(row.token_iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(row.token_tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(row.token_ciphertext, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

export async function persistMetaConnection({
  workspaceId,
  externalIdentityId,
  externalIdentityName,
  accessToken,
  tokenType,
  tokenExpiresAt,
  scopes,
  assets,
}) {
  const encrypted = encryptAccessToken(accessToken);
  const rows = await sb('content_os_connections?on_conflict=workspace_id,platform,external_identity_id', {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify([{
      workspace_id: workspaceId,
      platform: 'meta',
      connection_type: 'facebook_login_for_business',
      external_identity_id: externalIdentityId,
      external_identity_name: externalIdentityName || null,
      ...encrypted,
      token_type: tokenType || 'bearer',
      token_expires_at: tokenExpiresAt || null,
      scopes: scopes || [],
      assets: assets || [],
      status: 'connected',
      last_validated_at: new Date().toISOString(),
    }]),
  });
  return rows?.[0] || null;
}

export async function loadMetaAccessToken(workspaceId) {
  try {
    const rows = await sb(
      `content_os_connections?workspace_id=eq.${encodeURIComponent(workspaceId)}&platform=eq.meta&status=eq.connected&select=*&order=updated_at.desc&limit=1`,
      { method: 'GET' },
    );
    if (rows?.[0]?.token_ciphertext) return decryptAccessToken(rows[0]);
  } catch (error) {
    console.error('content-os credential load failed', error.message);
  }

  return process.env.INSTAGRAM_ACCESS_TOKEN || null;
}

export async function hasStoredMetaConnection(workspaceId) {
  try {
    const rows = await sb(
      `content_os_connections?workspace_id=eq.${encodeURIComponent(workspaceId)}&platform=eq.meta&status=eq.connected&select=id,external_identity_id,last_validated_at&order=updated_at.desc&limit=1`,
      { method: 'GET' },
    );
    return rows?.[0] || null;
  } catch (_) {
    return null;
  }
}
