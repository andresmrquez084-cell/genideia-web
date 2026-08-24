import crypto from 'node:crypto';
import { persistMetaConnection, sb } from './_meta-credentials.js';

const DEFAULT_APP_ID = '1568014338120103';
const DEFAULT_REDIRECT_URI = 'https://content-os-navy-seven.vercel.app/api/content-os/instagram-callback';
const GRAPH_VERSION = 'v26.0';
const PERMISSIONS = ['instagram_basic','instagram_manage_insights','pages_read_engagement','pages_show_list'];

function verifyState(state, secret) {
  if (!state || !secret) return null;
  const [body, sig] = String(state).split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (!payload?.workspaceId || !payload?.exp || Date.now() > payload.exp) return null;
  return payload;
}

function h(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function graph(path, accessToken, params = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Meta Graph ${response.status}`);
  return payload;
}

async function resolveAssets(accessToken) {
  let identity = null;
  let pages = [];

  try {
    const payload = await graph('me', accessToken, {
      fields: 'id,name,accounts.limit(100){id,name,access_token,tasks,business,instagram_business_account{id,username,account_type,media_count,followers_count,profile_picture_url}}',
    });
    identity = { id: payload?.id || null, name: payload?.name || null };
    pages = payload?.accounts?.data || [];
  } catch (_) {}

  if (!pages.length) {
    try {
      const payload = await graph('me/accounts', accessToken, {
        fields: 'id,name,access_token,tasks,business,instagram_business_account{id,username,account_type,media_count,followers_count,profile_picture_url}',
        limit: 100,
      });
      pages = payload?.data || [];
    } catch (_) {}
  }

  const instagramAccounts = pages
    .filter((page) => page.instagram_business_account?.id)
    .map((page) => ({
      pageId: page.id,
      pageName: page.name,
      business: page.business || null,
      tasks: page.tasks || [],
      ...page.instagram_business_account,
    }));

  return { identity, pages, instagramAccounts };
}

export default async function handler(req, res) {
  const error = req.query?.error;
  const errorDescription = req.query?.error_description;
  const code = req.query?.code;

  if (error) {
    res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0b0f17;color:#fff"><h1>Instagram no se conectó</h1><p>${h(errorDescription || error)}</p><p>Podés cerrar esta ventana y volver a Content OS.</p></body></html>`);
  }

  if (!code) {
    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0b0f17;color:#fff"><h1>GENIDEIA Content OS</h1><p>Callback de Instagram listo.</p></body></html>');
  }

  const state = verifyState(req.query?.state, process.env.CONTENT_OS_SYNC_SECRET);
  if (!state) {
    res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0b0f17;color:#fff"><h1>Autorización inválida o vencida</h1><p>Volvé a Content OS e iniciá nuevamente la conexión.</p></body></html>');
  }

  const appId = process.env.INSTAGRAM_APP_ID || DEFAULT_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || DEFAULT_REDIRECT_URI;

  if (!appSecret) {
    res.status(503).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0b0f17;color:#fff"><h1>Autorización recibida</h1><p>Falta configurar INSTAGRAM_APP_SECRET en Vercel para completar el intercambio seguro del código.</p></body></html>');
  }

  try {
    const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', String(code));

    const tokenResponse = await fetch(tokenUrl);
    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    const tokenData = tokenPayload?.data || tokenPayload;
    const accessToken = tokenData?.access_token;
    if (!tokenResponse.ok || !accessToken) {
      throw new Error(tokenPayload?.error?.message || 'No se pudo intercambiar el código de autorización');
    }

    const { identity, pages, instagramAccounts } = await resolveAssets(accessToken);
    const identityId = String(identity?.id || tokenData?.user_id || `system-user:${state.workspaceId}`);
    const expiresIn = Number(tokenData?.expires_in || 0);
    const tokenExpiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;

    const safeAssets = pages.map((page) => ({
      id: page.id,
      name: page.name,
      business: page.business || null,
      tasks: page.tasks || [],
      instagram_business_account: page.instagram_business_account || null,
    }));

    await persistMetaConnection({
      workspaceId: state.workspaceId,
      externalIdentityId: identityId,
      externalIdentityName: identity?.name || 'GENIDEIA Content OS System User',
      accessToken,
      tokenType: tokenData?.token_type || 'bearer',
      tokenExpiresAt,
      scopes: PERMISSIONS,
      assets: safeAssets,
    });

    for (const account of instagramAccounts) {
      await sb('content_os_accounts?on_conflict=workspace_id,platform,external_account_id', {
        method: 'POST',
        headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
        body: JSON.stringify([{
          workspace_id: state.workspaceId,
          platform: 'instagram',
          external_account_id: account.id,
          username: account.username || null,
          account_type: account.account_type || null,
          avatar_url: account.profile_picture_url || null,
          status: 'connected',
          permissions: PERMISSIONS,
          raw_profile: {
            id: account.id,
            username: account.username || null,
            account_type: account.account_type || null,
            media_count: account.media_count ?? null,
            followers_count: account.followers_count ?? null,
            facebook_page: {
              id: account.pageId,
              name: account.pageName,
              business: account.business || null,
              tasks: account.tasks || [],
            },
          },
        }]),
      });
    }

    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0b0f17;color:#fff"><h1>Meta conectado correctamente</h1><p>La credencial quedó guardada cifrada en el backend.</p><p>Cuentas profesionales detectadas: <strong>${instagramAccounts.length}</strong></p>${instagramAccounts.map((a) => `<p><strong>@${h(a.username || a.id)}</strong> · ${h(a.account_type || 'Instagram')}</p>`).join('')}<p>El token no se muestra ni se guarda en el navegador.</p><p>Podés cerrar esta ventana y volver a Content OS.</p></body></html>`);
  } catch (err) {
    console.error('instagram callback failed', err.message);
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0b0f17;color:#fff"><h1>No se pudo completar la conexión</h1><p>${h(err.message)}</p><p>Podés cerrar esta ventana y volver a Content OS.</p></body></html>`);
  }
}
