function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function headers() {
  const key = required('CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

async function sb(path, options = {}) {
  const base = required('CONTENT_OS_SUPABASE_URL');
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });

  try {
    const secret = required('CONTENT_OS_SYNC_SECRET');
    if (req.headers['x-content-os-secret'] !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const existing = await sb('content_os_workspaces?select=id,name,timezone,created_at&order=created_at.asc&limit=1');
    if (existing?.length) {
      return res.status(200).json({ ok: true, created: false, workspace: existing[0] });
    }

    const rows = await sb('content_os_workspaces', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify([{
        owner_id: null,
        name: 'GENIDEIA Content OS',
        timezone: 'America/Montevideo',
      }]),
    });

    return res.status(201).json({ ok: true, created: true, workspace: rows?.[0] || null });
  } catch (error) {
    console.error('content-os bootstrap failed', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}