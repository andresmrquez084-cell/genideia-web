create table if not exists public.content_os_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.content_os_workspaces(id) on delete cascade,
  platform text not null default 'meta',
  connection_type text not null default 'facebook_login_for_business',
  external_identity_id text not null,
  external_identity_name text,
  token_ciphertext text not null,
  token_iv text not null,
  token_tag text not null,
  token_type text,
  token_expires_at timestamptz,
  scopes jsonb not null default '[]'::jsonb,
  assets jsonb not null default '[]'::jsonb,
  status text not null default 'connected',
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, platform, external_identity_id)
);

create index if not exists content_os_connections_workspace_status_idx
  on public.content_os_connections(workspace_id, platform, status, updated_at desc);

alter table public.content_os_connections enable row level security;

drop trigger if exists set_content_os_connections_updated_at on public.content_os_connections;
create trigger set_content_os_connections_updated_at
before update on public.content_os_connections
for each row execute function public.set_updated_at();
