const GRAPH_BASE = 'https://graph.facebook.com';
const DEFAULT_SUPABASE_URL = 'https://dbwuubabafzsinaokawe.supabase.co';
const DEFAULT_WORKSPACE_ID = 'f2a0c61f-160c-4300-aac6-dcb8c89d98d7';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function supabaseKey() {
  return process.env.CONTENT_OS_SUPABASE_SECRET_KEY || process.env.CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY || null;
}

function supabaseHeaders() {
  const key = supabaseKey();
  if (!key) throw new Error('Missing CONTENT_OS_SUPABASE_SECRET_KEY');
  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
    Prefer: 'return=representation,resolution=merge-duplicates',
  };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function sb(path, options = {}) {
  const base = process.env.CONTENT_OS_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: { ...supabaseHeaders(), ...(options.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function apiVersion() {
  return process.env.INSTAGRAM_API_VERSION || 'v25.0';
}

async function graph(path, params = {}, token = null) {
  const accessToken = token || required('INSTAGRAM_ACCESS_TOKEN');
  const url = new URL(`${GRAPH_BASE}/${apiVersion()}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) throw new Error(`Meta Graph ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function graphAbsolute(urlString, token) {
  const url = new URL(urlString);
  if (!url.searchParams.get('access_token') && token) url.searchParams.set('access_token', token);
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) throw new Error(`Meta Graph ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function resolveInstagramAccount() {
  const userToken = required('INSTAGRAM_ACCESS_TOKEN');
  const payload = await graph('me/accounts', {
    fields: 'id,name,access_token,tasks,instagram_business_account{id,username,profile_picture_url,followers_count,media_count}',
    limit: 100,
  }, userToken);

  const pages = payload.data || [];
  const requestedPageId = process.env.INSTAGRAM_PAGE_ID || null;
  const requestedIgId = process.env.INSTAGRAM_USER_ID || null;

  let page = pages.find((p) => {
    if (!p.instagram_business_account) return false;
    if (requestedPageId && p.id !== requestedPageId) return false;
    if (requestedIgId && p.instagram_business_account.id !== requestedIgId) return false;
    return true;
  });

  if (!page && !requestedPageId && !requestedIgId) {
    page = pages.find((p) => p.instagram_business_account);
  }

  if (!page) {
    throw new Error('No Facebook Page with a linked Instagram professional account was found for this token. Verify the Page↔Instagram connection and permissions.');
  }

  const igUserId = page.instagram_business_account.id;
  const pageToken = page.access_token || userToken;
  const profile = await graph(igUserId, {
    fields: 'id,username,account_type,media_count,followers_count,profile_picture_url',
  }, pageToken);

  return { page, profile, igUserId, pageToken };
}

function metricValue(metric) {
  if (!metric) return null;
  if (metric.total_value && metric.total_value.value !== undefined) return metric.total_value.value;
  if (Array.isArray(metric.values) && metric.values.length) {
    const value = metric.values[metric.values.length - 1]?.value;
    return typeof value === 'object' && value !== null ? null : value;
  }
  return null;
}

function metricsObject(payload) {
  const result = {};
  for (const metric of payload?.data || []) result[metric.name] = metricValue(metric);
  return result;
}

async function getMediaInsights(media, pageToken) {
  const common = ['views','reach','likes','comments','shares','saved','total_interactions'];
  const reel = ['follows','profile_visits','ig_reels_video_view_total_time','ig_reels_avg_watch_time','clips_replays_count','ig_reels_aggregated_all_plays_count','reels_skip_rate'];
  const desired = media.media_product_type === 'REELS' ? [...common, ...reel] : common;

  try {
    return await graph(`${media.id}/insights`, { metric: desired.join(',') }, pageToken);
  } catch (_) {
    const data = [];
    for (const metric of desired) {
      try {
        const one = await graph(`${media.id}/insights`, { metric }, pageToken);
        if (Array.isArray(one.data)) data.push(...one.data);
      } catch (_) {}
    }
    return { data };
  }
}

async function getAccountInsights(userId, pageToken) {
  const desired = ['follower_count','reach','profile_views','accounts_engaged','total_interactions','likes','comments','shares','saves','replies','views','profile_links_taps'];
  try {
    return await graph(`${userId}/insights`, { metric: desired.join(','), period: 'day' }, pageToken);
  } catch (_) {
    const data = [];
    for (const metric of desired) {
      try {
        const one = await graph(`${userId}/insights`, { metric, period: 'day' }, pageToken);
        if (Array.isArray(one.data)) data.push(...one.data);
      } catch (_) {}
    }
    return { data };
  }
}

async function listRecentMedia(userId, pageToken, maxPages = 5) {
  const fields = 'id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,timestamp,username';
  let payload = await graph(`${userId}/media`, { fields, limit: 100 }, pageToken);
  const all = [...(payload.data || [])];
  let pages = 1;
  while (payload?.paging?.next && pages < maxPages) {
    payload = await graphAbsolute(payload.paging.next, pageToken);
    all.push(...(payload.data || []));
    pages += 1;
  }
  return all;
}

async function startRun(workspaceId, accountId) {
  const rows = await sb('content_os_sync_runs', {
    method: 'POST',
    body: JSON.stringify([{ workspace_id: workspaceId, account_id: accountId, job_type: 'instagram_full_sync', status: 'running' }]),
  });
  return rows?.[0]?.id;
}

async function finishRun(runId, values) {
  if (!runId) return;
  await sb(`content_os_sync_runs?id=eq.${encodeURIComponent(runId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...values, finished_at: new Date().toISOString() }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const syncSecret = required('CONTENT_OS_SYNC_SECRET');
  if (req.headers['x-content-os-secret'] !== syncSecret) return res.status(401).json({ error: 'Unauthorized' });

  const workspaceId = process.env.CONTENT_OS_WORKSPACE_ID || DEFAULT_WORKSPACE_ID;
  const capturedAt = new Date().toISOString();
  let runId = null;
  let imported = 0;
  let snapshots = 0;
  let errors = 0;

  try {
    const { page, profile, igUserId, pageToken } = await resolveInstagramAccount();

    const accountRows = await sb('content_os_accounts?on_conflict=workspace_id,platform,external_account_id', {
      method: 'POST',
      body: JSON.stringify([{
        workspace_id: workspaceId,
        platform: 'instagram',
        external_account_id: profile.id,
        username: profile.username,
        account_type: profile.account_type,
        status: 'connected',
        permissions: ['instagram_basic','instagram_manage_insights','pages_read_engagement','pages_show_list'],
        last_synced_at: capturedAt,
        raw_profile: { ...profile, facebook_page: { id: page.id, name: page.name, tasks: page.tasks || [] } },
      }]),
    });
    const accountId = accountRows?.[0]?.id;
    if (!accountId) throw new Error('Could not resolve Content OS Instagram account row');
    runId = await startRun(workspaceId, accountId);

    const media = await listRecentMedia(igUserId, pageToken);
    for (const item of media) {
      try {
        const contentRows = await sb('content_os_content?on_conflict=account_id,external_content_id', {
          method: 'POST',
          body: JSON.stringify([{
            workspace_id: workspaceId,
            account_id: accountId,
            platform: 'instagram',
            external_content_id: item.id,
            media_type: item.media_type,
            media_product_type: item.media_product_type,
            title: (item.caption || '').split('\n')[0].slice(0, 180) || null,
            caption: item.caption || null,
            permalink: item.permalink || null,
            media_url: item.media_url || null,
            thumbnail_url: item.thumbnail_url || null,
            published_at: item.timestamp || null,
            status: 'published',
            raw_media: item,
          }]),
        });
        const contentId = contentRows?.[0]?.id;
        if (!contentId) throw new Error(`Could not resolve content row for ${item.id}`);
        imported += 1;

        const insightPayload = await getMediaInsights(item, pageToken);
        const m = metricsObject(insightPayload);
        const published = item.timestamp ? new Date(item.timestamp).getTime() : Date.now();
        const ageMinutes = Math.max(0, Math.round((Date.now() - published) / 60000));

        await sb('content_os_metric_snapshots', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify([{
            workspace_id: workspaceId,
            content_id: contentId,
            captured_at: capturedAt,
            age_minutes: ageMinutes,
            views: m.views ?? m.plays ?? null,
            reach: m.reach ?? null,
            likes: m.likes ?? null,
            comments: m.comments ?? null,
            shares: m.shares ?? null,
            saves: m.saved ?? null,
            replies: m.replies ?? null,
            follows: m.follows ?? null,
            profile_visits: m.profile_visits ?? null,
            total_interactions: m.total_interactions ?? null,
            video_view_total_time_ms: m.ig_reels_video_view_total_time ?? null,
            avg_watch_time_ms: m.ig_reels_avg_watch_time ?? null,
            replays: m.clips_replays_count ?? null,
            metric_payload: insightPayload,
          }]),
        });
        snapshots += 1;
      } catch (error) {
        errors += 1;
        console.error('content-os media sync error', item.id, error.message);
      }
    }

    const accountPayload = await getAccountInsights(igUserId, pageToken);
    const a = metricsObject(accountPayload);
    await sb('content_os_account_snapshots', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([{
        workspace_id: workspaceId,
        account_id: accountId,
        captured_at: capturedAt,
        follower_count: a.follower_count ?? profile.followers_count ?? null,
        reach: a.reach ?? null,
        profile_views: a.profile_views ?? null,
        accounts_engaged: a.accounts_engaged ?? null,
        total_interactions: a.total_interactions ?? null,
        likes: a.likes ?? null,
        comments: a.comments ?? null,
        shares: a.shares ?? null,
        saves: a.saves ?? null,
        replies: a.replies ?? null,
        views: a.views ?? null,
        profile_links_taps: a.profile_links_taps ?? null,
        metric_payload: accountPayload,
      }]),
    });

    await finishRun(runId, { status: errors ? 'completed_with_errors' : 'completed', imported_count: imported, snapshot_count: snapshots, error_count: errors });
    return res.status(200).json({ ok: true, instagramUserId: igUserId, pageId: page.id, imported, snapshots, errors, capturedAt });
  } catch (error) {
    console.error('content-os sync failed', error);
    if (runId) await finishRun(runId, { status: 'failed', imported_count: imported, snapshot_count: snapshots, error_count: errors + 1, error_message: error.message }).catch(() => {});
    return res.status(500).json({ ok: false, error: error.message, imported, snapshots, errors: errors + 1 });
  }
}
