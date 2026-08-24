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

  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || 'https://content-os-navy-seven.vercel.app/api/content-os/instagram-callback';

  if (!appId || !appSecret) {
    res.status(503).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end('<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0b0f17;color:#fff"><h1>Autorización recibida</h1><p>Falta terminar de configurar las credenciales de Meta en el backend.</p><p>Podés cerrar esta ventana y volver a Content OS.</p></body></html>');
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

    // For the first account we only validate that OAuth works. The token is intentionally
    // not exposed in the browser or logs. Persistent multi-client credential storage is
    // handled separately before enabling client self-service connections.
    const meUrl = new URL('https://graph.facebook.com/v26.0/me');
    meUrl.searchParams.set('fields', 'id,name');
    meUrl.searchParams.set('access_token', tokenPayload.access_token);
    const meResponse = await fetch(meUrl);
    const me = await meResponse.json();
    if (!meResponse.ok) throw new Error(me?.error?.message || 'No se pudo validar la autorización');

    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0b0f17;color:#fff"><h1>Meta conectado correctamente</h1><p>Autorización validada para ${String(me.name || 'la cuenta')}.</p><p>El token no se muestra ni se guarda en el navegador.</p><p>Podés cerrar esta ventana y volver a Content OS.</p></body></html>`);
  } catch (err) {
    console.error('instagram callback failed', err);
    res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#0b0f17;color:#fff"><h1>No se pudo completar la conexión</h1><p>${String(err.message)}</p><p>Podés cerrar esta ventana y volver a Content OS.</p></body></html>`);
  }
}
