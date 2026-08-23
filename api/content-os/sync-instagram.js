const IG_BASE = 'https://graph.instagram.com';

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
  // Legacy service_role keys are JWTs; new sb_secret_* keys must not be sent as Bearer JWTs.
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function sb(path, options = {}) {
  const base = required('CONTENT_OS_SUPABASE_URL');
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: { ...supabaseHeaders(), ...(options.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function ig(path, params = {}) {
  const version = process.env.INSTAGRAM_API_VERSION || 'v26.0';
  const token = required('INSTAGRAM_ACCESS_TOKEN');
  const url = new URL(`${IG_BASE}/${version}/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Instagram ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function igAbsolute(urlString) {
  const token = required('INSTAGRAM_ACCESS_TOKEN');
  const response = await fetch(urlString, { headers: { Authorization: `Bearer ${token}` } });
  const text = await response.text();
  if (!response.ok) throw new Error(`Instagram ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
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

async function getMediaInsights(media) {
  const common = ['views','reach','likes','comments','shares','saved','total_interactions'];
  const reel = ['follows','profile_visits','ig_reels_video_view_total_time','ig_reels_avg_watch_time','clips_replays_count','ig_reels_aggregated_all_plays_count','reels_skip_rate'];
  const desired = media.media_product_type === 'REELS' ? [...common, ...reel] : common;

  try {
    return await ig(`${media.id}/insights`, { metric: desired.join(',') });
  } catch (_) {
    const data = [];
    for (const metric of desired) {
      try {
        const one = await ig(`${media.id}/insights`, { metric });
        if (Array.isArray(one.data)) data.push(...one.data);
      } catch (_) {}
    }
    return { data };
  }
}

async function getAccountInsights(userId) {
  const desired = ['follower_count','reach','profile_views','accounts_engaged','total_interactions','likes','comments','shares','saves','replies','views','profile_links_taps'];
  try {
    return await ig(`${userId}/insights`, { metric: desired.join(','), period: 'day' });
  } catch (_) {
    const data = [];
    for (const metric of desired) {
      try {
        const one = await ig(`${userId}/insights`, { metric, period: 'day' });
        if (Array.isArray(one.data)) data.push(...one.data);
      } catch (_) {}
    }
    return { data };
  }
}

async function listRecentMedia(userId, maxPages = 5) {
  const fields = 'id,caption,media_type,media_product_type,permalink,media_url,thumbnail_url,timestamp,username';
  let payload = await ig(`${userId}/media`, { fields, limit: 100 });
  const all = [...(payload.data || [])];
  let pages = 1;
  while (payload?.paging?.next && pages < maxPages) {
    payload = await igAbsolute(payload.paging.next);
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

  const workspaceId = required('CONTENT_OS_WORKSPACE_ID');
  const userId = required('INSTAGRAM_USER_ID');
  const capturedAt = new Date().toISOString();
  let runId = null;
  let imported = 0;
  let snapshots = 0;
  let errors = 0;

  try {
    const profile = await ig(userId, { fields: 'id,username,account_type,media_count' });
    const accountRows = await sb('content_os_accounts?on_conflict=workspace_id,platform,external_account_id', {
      method: 'POST',
      body: JSON.stringify([{
        workspace_id: workspaceId,
        platform: 'instagram',
        external_account_id: profile.id,
        username: profile.username,
        account_type: profile.account_type,
        status: 'connected',
        permissions: ['instagram_business_basic','instagram_business_manage_insights'],
        last_synced_at: capturedAt,
        raw_profile: profile,
      }]),
    });
    const accountId = accountRows?.[0]?.id;
    if (!accountId) throw new Error('Could not resolve Content OS Instagram account row');
    runId = await startRun(workspaceId, accountId);

    const media = await listRecentMedia(userId);
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

        const insightPayload = await getMediaInsights(item);
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

    const accountPayload = await getAccountInsights(userId);
    const a = metricsObject(accountPayload);
    await sb('content_os_account_snapshots', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify([{
        workspace_id: workspaceId,
        account_id: accountId,
        captured_at: capturedAt,
        follower_count: a.follower_count ?? null,
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
    return res.status(200).json({ ok: true, imported, snapshots, errors, capturedAt });
  } catch (error) {
    console.error('content-os sync failed', error);
    if (runId) await finishRun(runId, { status: 'failed', imported_count: imported, snapshot_count: snapshots, error_count: errors + 1, error_message: error.message }).catch(() => {});
    return res.status(500).json({ ok: false, error: error.message, imported, snapshots, errors: errors + 1 });
  }
}
