alter table public.content_os_story_sequences
  add column if not exists perception_direction text,
  add column if not exists nutrition_type text,
  add column if not exists cta_optimization text,
  add column if not exists mechanism_attributes jsonb not null default '[]'::jsonb,
  add column if not exists marketing_angle text,
  add column if not exists structure_name text,
  add column if not exists hook_text text,
  add column if not exists story_count integer,
  add column if not exists views_initial bigint,
  add column if not exists views_final bigint,
  add column if not exists replies_count bigint,
  add column if not exists retention_rate numeric,
  add column if not exists response_rate numeric,
  add column if not exists lead_quality text,
  add column if not exists result text,
  add column if not exists evidence_url text,
  add column if not exists learning text;

create table if not exists public.content_os_story_filter_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.content_os_workspaces(id) on delete cascade,
  sequence_id uuid not null references public.content_os_story_sequences(id) on delete cascade,
  pass_type text not null check (pass_type in ('guion','revision','publicacion')),
  criteria jsonb not null default '[false,false,false,false,false,false]'::jsonb,
  completed_count integer not null default 0 check (completed_count between 0 and 6),
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sequence_id, pass_type)
);

create index if not exists content_os_story_filter_reviews_workspace_idx
  on public.content_os_story_filter_reviews(workspace_id, reviewed_at desc);

create table if not exists public.content_os_competitor_story_sequences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.content_os_workspaces(id) on delete cascade,
  competitor_id uuid references public.content_os_competitors(id) on delete set null,
  creator text not null,
  niche text,
  source_url text,
  perception_direction text,
  nutrition_type text,
  objective text,
  cta_optimization text,
  mechanism_attributes jsonb not null default '[]'::jsonb,
  marketing_angle text,
  structure_name text,
  hook_text text,
  story_count integer,
  evidence jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_os_competitor_story_sequences_workspace_idx
  on public.content_os_competitor_story_sequences(workspace_id, created_at desc);

alter table public.content_os_story_filter_reviews enable row level security;
alter table public.content_os_competitor_story_sequences enable row level security;

drop policy if exists content_os_story_filter_reviews_owner_all on public.content_os_story_filter_reviews;
create policy content_os_story_filter_reviews_owner_all
on public.content_os_story_filter_reviews
for all
to authenticated
using (exists (
  select 1 from public.content_os_workspaces w
  where w.id = content_os_story_filter_reviews.workspace_id
    and w.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.content_os_workspaces w
  where w.id = content_os_story_filter_reviews.workspace_id
    and w.owner_id = auth.uid()
));

drop policy if exists content_os_competitor_story_sequences_owner_all on public.content_os_competitor_story_sequences;
create policy content_os_competitor_story_sequences_owner_all
on public.content_os_competitor_story_sequences
for all
to authenticated
using (exists (
  select 1 from public.content_os_workspaces w
  where w.id = content_os_competitor_story_sequences.workspace_id
    and w.owner_id = auth.uid()
))
with check (exists (
  select 1 from public.content_os_workspaces w
  where w.id = content_os_competitor_story_sequences.workspace_id
    and w.owner_id = auth.uid()
));

drop trigger if exists set_content_os_story_filter_reviews_updated_at on public.content_os_story_filter_reviews;
create trigger set_content_os_story_filter_reviews_updated_at
before update on public.content_os_story_filter_reviews
for each row execute function public.set_updated_at();

drop trigger if exists set_content_os_competitor_story_sequences_updated_at on public.content_os_competitor_story_sequences;
create trigger set_content_os_competitor_story_sequences_updated_at
before update on public.content_os_competitor_story_sequences
for each row execute function public.set_updated_at();
