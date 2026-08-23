async function checkSupabase() {
  const base = process.env.CONTENT_OS_SUPABASE_URL;
  const key = process.env.CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;

  try {
    const r = await fetch(`${base}/rest/v1/content_os_workspaces?select=id,name,timezone&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const text = await r.text();
    return r.ok
      ? { ok: true, status: r.status, workspace: text ? JSON.parse(text)?.[0] || null : null }
      : { ok: false, status: r.status, error: text };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export default async function handler(req, res) {
  const configured = {
    supabaseUrl: Boolean(process.env.CONTENT_OS_SUPABASE_URL),
    supabaseServiceRole: Boolean(process.env.CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY),
    workspace: Boolean(process.env.CONTENT_OS_WORKSPACE_ID),
    syncSecret: Boolean(process.env.CONTENT_OS_SYNC_SECRET),
    instagramToken: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN),
    instagramUserId: Boolean(process.env.INSTAGRAM_USER_ID),
    instagramApp: Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET),
  };

  const supabase = await checkSupabase();

  let instagram = null;
  if (configured.instagramToken && configured.instagramUserId) {
    try {
      const version = process.env.INSTAGRAM_API_VERSION || 'v26.0';
      const url = new URL(`https://graph.instagram.com/${version}/${process.env.INSTAGRAM_USER_ID}`);
      url.searchParams.set('fields', 'id,username,account_type,media_count');
      const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}` } });
      instagram = r.ok
        ? { ok: true, status: r.status, profile: await r.json() }
        : { ok: false, status: r.status, error: await r.text() };
    } catch (error) {
      instagram = { ok: false, error: error.message };
    }
  }

  const readyForBootstrap = configured.supabaseUrl && configured.supabaseServiceRole && configured.syncSecret && supabase?.ok;
  const readyForInstagramSync = readyForBootstrap && configured.workspace && configured.instagramToken && configured.instagramUserId;

  res.status(200).json({
    service: 'GENIDEIA Content OS',
    ok: true,
    configured,
    supabase,
    instagram,
    readyForBootstrap,
    readyForInstagramSync,
    timestamp: new Date().toISOString(),
  });
}