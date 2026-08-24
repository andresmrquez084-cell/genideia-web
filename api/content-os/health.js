import { hasStoredMetaConnection, loadMetaAccessToken } from './_meta-credentials.js';

const DEFAULT_SUPABASE_URL = 'https://dbwuubabafzsinaokawe.supabase.co';
const DEFAULT_WORKSPACE_ID = 'f2a0c61f-160c-4300-aac6-dcb8c89d98d7';

function supabaseKey() {
  return process.env.CONTENT_OS_SUPABASE_SECRET_KEY || process.env.CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY || null;
}

async function checkSupabase() {
  const base = process.env.CONTENT_OS_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = supabaseKey();
  if (!base || !key) return null;

  try {
    const headers = { apikey: key };
    if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
    const r = await fetch(`${base}/rest/v1/content_os_workspaces?select=id,name,timezone&limit=1`, { headers });
    const text = await r.text();
    return r.ok
      ? { ok: true, status: r.status, workspace: text ? JSON.parse(text)?.[0] || null : null }
      : { ok: false, status: r.status, error: text };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function checkInstagram(token) {
  if (!token) return null;

  try {
    const version = process.env.INSTAGRAM_API_VERSION || 'v26.0';
    let pages = [];

    const url = new URL(`https://graph.facebook.com/${version}/me/accounts`);
    url.searchParams.set('fields', 'id,name,instagram_business_account{id,username,account_type,media_count,followers_count}');
    url.searchParams.set('limit', '100');
    url.searchParams.set('access_token', token);
    const r = await fetch(url);
    if (r.ok) {
      const payload = await r.json();
      pages = payload?.data || [];
    }

    if (!pages.length) {
      const fallback = new URL(`https://graph.facebook.com/${version}/me`);
      fallback.searchParams.set('fields', 'accounts.limit(100){id,name,instagram_business_account{id,username,account_type,media_count,followers_count}}');
      fallback.searchParams.set('access_token', token);
      const fr = await fetch(fallback);
      const fp = await fr.json().catch(() => ({}));
      if (!fr.ok) return { ok: false, status: fr.status, error: fp?.error?.message || 'Meta Graph request failed' };
      pages = fp?.accounts?.data || [];
    }

    const requestedPageId = process.env.INSTAGRAM_PAGE_ID || null;
    const requestedIgId = process.env.INSTAGRAM_USER_ID || null;
    const page = pages.find((p) => {
      if (!p.instagram_business_account) return false;
      if (requestedPageId && p.id !== requestedPageId) return false;
      if (requestedIgId && p.instagram_business_account.id !== requestedIgId) return false;
      return true;
    }) || (!requestedPageId && !requestedIgId ? pages.find((p) => p.instagram_business_account) : null);

    if (!page) {
      return { ok: false, status: 200, error: 'Meta connection is valid, but no linked Instagram professional account was found.' };
    }

    return {
      ok: true,
      status: 200,
      page: { id: page.id, name: page.name },
      profile: page.instagram_business_account,
    };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export default async function handler(req, res) {
  const workspaceId = process.env.CONTENT_OS_WORKSPACE_ID || DEFAULT_WORKSPACE_ID;
  const [supabase, storedConnection, token] = await Promise.all([
    checkSupabase(),
    hasStoredMetaConnection(workspaceId),
    loadMetaAccessToken(workspaceId),
  ]);
  const instagram = await checkInstagram(token);

  const configured = {
    supabaseUrl: true,
    supabaseSecret: Boolean(supabaseKey()),
    workspace: true,
    syncSecret: Boolean(process.env.CONTENT_OS_SYNC_SECRET),
    instagramToken: Boolean(token),
    storedMetaConnection: Boolean(storedConnection),
    instagramUserId: Boolean(process.env.INSTAGRAM_USER_ID),
    instagramPageId: Boolean(process.env.INSTAGRAM_PAGE_ID),
    instagramApp: Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET),
    instagramLoginMode: 'facebook-business',
  };

  const readyForBootstrap = configured.supabaseSecret && configured.syncSecret && supabase?.ok;
  const readyForInstagramSync = readyForBootstrap && configured.instagramToken && instagram?.ok;

  res.status(200).json({
    service: 'GENIDEIA Content OS',
    ok: true,
    projectRef: 'dbwuubabafzsinaokawe',
    workspaceId,
    configured,
    supabase,
    instagram,
    readyForBootstrap,
    readyForInstagramSync,
    timestamp: new Date().toISOString(),
  });
}
