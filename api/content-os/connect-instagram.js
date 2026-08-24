import crypto from 'node:crypto';

const DEFAULT_APP_ID = '1568014338120103';
const DEFAULT_CONFIG_ID = '2242238763229247';
const DEFAULT_WORKSPACE_ID = 'f2a0c61f-160c-4300-aac6-dcb8c89d98d7';
const DEFAULT_REDIRECT_URI = 'https://content-os-navy-seven.vercel.app/api/content-os/instagram-callback';

function signState(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export default async function handler(req, res) {
  const appId = process.env.INSTAGRAM_APP_ID || DEFAULT_APP_ID;
  const configId = process.env.INSTAGRAM_CONFIG_ID || DEFAULT_CONFIG_ID;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || DEFAULT_REDIRECT_URI;
  const stateSecret = process.env.CONTENT_OS_SYNC_SECRET;

  if (!stateSecret) {
    return res.status(503).json({ error: 'Missing CONTENT_OS_SYNC_SECRET' });
  }

  const workspaceId = String(req.query?.workspace_id || process.env.CONTENT_OS_WORKSPACE_ID || DEFAULT_WORKSPACE_ID);
  const state = signState({ workspaceId, exp: Date.now() + 10 * 60 * 1000 }, stateSecret);

  const url = new URL('https://www.facebook.com/v26.0/dialog/oauth');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('config_id', configId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('override_default_response_type', 'true');
  url.searchParams.set('state', state);

  res.statusCode = 302;
  res.setHeader('Location', url.toString());
  res.setHeader('Cache-Control', 'no-store');
  return res.end();
}
