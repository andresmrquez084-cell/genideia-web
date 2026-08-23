export default async function handler(req, res) {
  const configured = {
    supabaseUrl: Boolean(process.env.CONTENT_OS_SUPABASE_URL),
    supabaseServiceRole: Boolean(process.env.CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY),
    workspace: Boolean(process.env.CONTENT_OS_WORKSPACE_ID),
    instagramToken: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN),
    instagramUserId: Boolean(process.env.INSTAGRAM_USER_ID),
    instagramApp: Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET),
  };

  let instagram = null;
  if (configured.instagramToken && configured.instagramUserId) {
    try {
      const version = process.env.INSTAGRAM_API_VERSION || 'v26.0';
      const url = new URL(`https://graph.instagram.com/${version}/${process.env.INSTAGRAM_USER_ID}`);
      url.searchParams.set('fields', 'id,username,account_type,media_count');
      const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}` } });
      instagram = r.ok ? { ok: true, status: r.status, profile: await r.json() } : { ok: false, status: r.status, error: await r.text() };
    } catch (error) {
      instagram = { ok: false, error: error.message };
    }
  }

  res.status(200).json({
    service: 'GENIDEIA Content OS',
    ok: true,
    configured,
    instagram,
    timestamp: new Date().toISOString(),
  });
}
