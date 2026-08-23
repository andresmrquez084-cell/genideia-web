-- Content OS bootstrap / operational indexes
-- Keeps the workspace private (RLS remains enabled) while allowing the server-side
-- service role to create the initial workspace before Supabase Auth is wired in.

alter table public.content_os_workspaces
  alter column owner_id drop not null;

create index if not exists content_os_content_workspace_published_idx
  on public.content_os_content(workspace_id, published_at desc);

create index if not exists content_os_content_account_published_idx
  on public.content_os_content(account_id, published_at desc);

create index if not exists content_os_story_sequences_workspace_created_idx
  on public.content_os_story_sequences(workspace_id, created_at desc);

create index if not exists content_os_competitor_content_workspace_published_idx
  on public.content_os_competitor_content(workspace_id, published_at desc);

create index if not exists content_os_leads_workspace_stage_idx
  on public.content_os_leads(workspace_id, stage, updated_at desc);

create index if not exists content_os_followups_due_idx
  on public.content_os_followups(status, due_at)
  where status = 'pending';

create index if not exists content_os_sales_workspace_closed_idx
  on public.content_os_sales(workspace_id, closed_at desc);

comment on column public.content_os_workspaces.owner_id is
  'Nullable during server-side bootstrap. Once Auth is enabled, assign the workspace to auth.users.id.';