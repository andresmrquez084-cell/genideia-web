import crypto from 'node:crypto';

const DEFAULT_APP_ID = '1568014338120103';
const DEFAULT_REDIRECT_URI = 'https://content-os-navy-seven.vercel.app/api/content-os/instagram-callback';

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

export default async function handler(req, res) {
  const error = req.query?.error;
  const errorDescription = req.query?.error_description;
  const code = req.query?.code;

  if (error) {
    res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0b0f17;color:#fff"><h1>Instagram no se conectó</h1><p>${String(errorDescription || error)}</p><p>Podés cerrar esta ventana y volver a Content OS.</p></body></html>`);
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
    return res.end('<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0b0f17;color:#fff"><h1>Autorización recibida</h1><p>Falta configurar INSTAGRAM_APP_SECRET en Vercel para completar el intercambio seguro del código.</p><p>Podés cerrar esta ventana y volver a Content OS.</p></body></html>');
  }

  try {
    const tokenUrl = new URL('https://graph.facebook.com/v26.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', String(code));

    const tokenResponse = await fetch(tokenUrl);
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      throw new Error(tokenPayload?.error?.message || 'No se pudo intercambiar el código de autorización');
    }

    const pagesUrl = new URL('https://graph.facebook.com/v26.0/me/accounts');
    pagesUrl.searchParams.set('fields', 'id,name,instagram_business_account{id,username,account_type,media_count}');
    pagesUrl.searchParams.set('access_token', tokenPayload.access_token);
    const pagesResponse = await fetch(pagesUrl);
    const pagesPayload = await pagesResponse.json();
    if (!pagesResponse.ok) throw new Error(pagesPayload?.error?.message || 'No se pudieron leer los activos autorizados');

    const pages = Array.isArray(pagesPayload?.data) ? pagesPayload.data : [];
    const instagramAccounts = pages
      .filter((page) => page.instagram_business_account?.id)
      .map((page) => ({ pageId: page.id, pageName: page.name, ...page.instagram_business_account }));

    // Temporary validation only: the token is used in memory and never returned to the browser.
    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0b0f17;color:#fff"><h1>Meta conectado correctamente</h1><p>Workspace: ${String(state.workspaceId)}</p><p>Cuentas profesionales detectadas: ${instagramAccounts.length}</p>${instagramAccounts.map((a) => `<p><strong>@${String(a.username || a.id)}</strong> · ${String(a.account_type || 'Instagram')}</p>`).join('')}<p>El token no se muestra ni se guarda en el navegador. Esta primera conexión valida el flujo completo antes de activar el almacenamiento cifrado.</p><p>Podés cerrar esta ventana y volver a Content OS.</p></body></html>`);
  } catch (err) {
    console.error('instagram callback failed', err.message);
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0b0f17;color:#fff"><h1>No se pudo completar la conexión</h1><p>${String(err.message)}</p><p>Podés cerrar esta ventana y volver a Content OS.</p></body></html>`);
  }
}
