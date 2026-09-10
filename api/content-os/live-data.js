import { verifyContentOsSession } from '../../lib/content-os-session.js';

const DEFAULT_SUPABASE_URL = 'https://dbwuubabafzsinaokawe.supabase.co';
const DEFAULT_WORKSPACE_ID = 'f2a0c61f-160c-4300-aac6-dcb8c89d98d7';

function supabaseKey() {
  return process.env.CONTENT_OS_SUPABASE_SECRET_KEY || process.env.CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY || null;
}

function headers() {
  const key = supabaseKey();
  if (!key) throw new Error('Missing CONTENT_OS_SUPABASE_SECRET_KEY');
  const h = { apikey: key, Accept: 'application/json' };
  if (!key.startsWith('sb_secret_')) h.Authorization = `Bearer ${key}`;
  return h;
}

async function sb(path) {
  const base = process.env.CONTENT_OS_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const response = await fetch(`${base}/rest/v1/${path}`, { headers: headers() });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

async function sbPaged(path, pageSize = 1000) {
  const rows = [];
  let offset = 0;
  while (true) {
    const separator = path.includes('?') ? '&' : '?';
    const page = await sb(`${path}${separator}limit=${pageSize}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET required' });
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (!verifyContentOsSession(req)) return res.status(401).json({ ok: false, error: 'AUTH_REQUIRED' });

  try {
    const workspaceId = process.env.CONTENT_OS_WORKSPACE_ID || DEFAULT_WORKSPACE_ID;
    const encodedWorkspace = encodeURIComponent(workspaceId);

    const accounts = await sb(`content_os_accounts?workspace_id=eq.${encodedWorkspace}&select=id,platform,external_account_id,username,account_type,display_name,avatar_url,status,last_synced_at,raw_profile&order=last_synced_at.desc`);
    const activeAccount = accounts.find((a) => a.status === 'connected') || accounts[0] || null;

    if (!activeAccount) {
      return res.status(200).json({
        ok: true,
        source: 'supabase',
        workspaceId,
        accounts: [],
        content: [],
        counts: { accounts: 0, content: 0, latestMetrics: 0, snapshots: 0, classifications: 0 },
        latestSync: null,
        generatedAt: new Date().toISOString(),
      });
    }

    const encodedAccount = encodeURIComponent(activeAccount.id);
    const [contents, accountSnapshots, syncRuns] = await Promise.all([
      sb(`content_os_content?workspace_id=eq.${encodedWorkspace}&account_id=eq.${encodedAccount}&select=id,account_id,platform,external_content_id,media_type,media_product_type,title,caption,permalink,media_url,thumbnail_url,duration_seconds,published_at,status,series_name,pipeline_stage,raw_media&order=published_at.desc&limit=500`),
      sb(`content_os_account_snapshots?workspace_id=eq.${encodedWorkspace}&account_id=eq.${encodedAccount}&select=account_id,captured_at,follower_count,reach,profile_views,accounts_engaged,total_interactions,likes,comments,shares,saves,replies,views,follows,unfollows,profile_links_taps&order=captured_at.desc&limit=20`),
      sb(`content_os_sync_runs?workspace_id=eq.${encodedWorkspace}&account_id=eq.${encodedAccount}&select=id,account_id,job_type,status,started_at,finished_at,imported_count,snapshot_count,error_count,error_message&order=started_at.desc&limit=10`),
    ]);

    let latestMetrics = [];
    let classifications = [];
    let metricSnapshots = [];
    if (contents.length) {
      const ids = contents.map((c) => c.id).join(',');
      [latestMetrics, classifications, metricSnapshots] = await Promise.all([
        sb(`content_os_latest_metrics?content_id=in.(${ids})&select=content_id,captured_at,age_minutes,views,reach,likes,comments,shares,saves,replies,follows,profile_visits,total_interactions,video_view_total_time_ms,avg_watch_time_ms,replays,metric_payload`),
        sb(`content_os_classifications?content_id=in.(${ids})&select=content_id,format,topic,subtopic,hook_text,hook_type,intention,expected_action,audience,cta,visual_style,editing_style,spoken,on_screen_text,tools_mentioned,ai_confidence,manually_reviewed`),
        sbPaged(`content_os_metric_snapshots?content_id=in.(${ids})&select=content_id,captured_at,age_minutes,views,reach,likes,comments,shares,saves,replies,follows,profile_visits,total_interactions,video_view_total_time_ms,avg_watch_time_ms,replays&order=captured_at.asc`),
      ]);
    }

    const latestByContent = Object.fromEntries(latestMetrics.map((m) => [m.content_id, m]));
    const classificationByContent = Object.fromEntries(classifications.map((c) => [c.content_id, c]));
    const snapshotsByContent = {};
    for (const snapshot of metricSnapshots) {
      (snapshotsByContent[snapshot.content_id] ||= []).push(snapshot);
    }

    const hydratedContent = contents.map((item) => ({
      ...item,
      classification: classificationByContent[item.id] || null,
      metrics: latestByContent[item.id] || null,
      snapshots: snapshotsByContent[item.id] || [],
    }));

    const latestAccountSnapshot = accountSnapshots[0] || null;
    const counts = {
      accounts: 1,
      content: contents.length,
      latestMetrics: latestMetrics.length,
      snapshots: metricSnapshots.length,
      classifications: classifications.length,
    };
    const maxSnapshotsPerContent = Math.max(0, ...Object.values(snapshotsByContent).map((items) => items.length));

    if (req.query?.health === '1') {
      return res.status(200).json({
        ok: true,
        source: 'supabase',
        workspaceId,
        account: activeAccount.username || null,
        accountId: activeAccount.id,
        counts,
        maxSnapshotsPerContent,
        velocityReady: maxSnapshotsPerContent >= 2,
        latestSync: syncRuns[0] || null,
        ignoredDuplicateAccounts: Math.max(0, accounts.length - 1),
        generatedAt: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      ok: true,
      source: 'supabase',
      workspaceId,
      accounts: [{ ...activeAccount, snapshot: latestAccountSnapshot }],
      content: hydratedContent,
      counts,
      latestSync: syncRuns[0] || null,
      ignoredDuplicateAccounts: Math.max(0, accounts.length - 1),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('content-os live data failed', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
