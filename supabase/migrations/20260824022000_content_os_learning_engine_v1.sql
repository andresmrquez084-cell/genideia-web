alter table public.content_os_classifications
  add column if not exists element_count integer,
  add column if not exists main_promise text,
  add column if not exists knowledge_level text,
  add column if not exists free_tags jsonb not null default '[]'::jsonb,
  add column if not exists classification_source text not null default 'ai',
  add column if not exists classification_notes text;

alter table public.content_os_metric_snapshots
  add column if not exists retention_rate numeric,
  add column if not exists completion_rate numeric;

create table if not exists public.content_os_hypotheses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.content_os_workspaces(id) on delete cascade,
  title text not null,
  statement text not null,
  target_metric text,
  comparison_definition jsonb not null default '{}'::jsonb,
  confounders jsonb not null default '[]'::jsonb,
  sample_size integer not null default 0,
  supporting_count integer not null default 0,
  contradicting_count integer not null default 0,
  neutral_count integer not null default 0,
  confidence_level text not null default 'low' check (confidence_level in ('low','medium','high')),
  status text not null default 'observing' check (status in ('observing','testing','supported','contradicted','promoted_to_rule','archived')),
  next_experiment text,
  rationale text,
  generated_by text not null default 'system',
  last_evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_os_hypotheses_workspace_status_idx
  on public.content_os_hypotheses(workspace_id,status,updated_at desc);

create table if not exists public.content_os_hypothesis_evidence (
  id uuid primary key default gen_random_uuid(),
  hypothesis_id uuid not null references public.content_os_hypotheses(id) on delete cascade,
  content_id uuid references public.content_os_content(id) on delete cascade,
  experiment_id uuid references public.content_os_experiments(id) on delete set null,
  direction text not null default 'neutral' check (direction in ('supports','contradicts','neutral')),
  evidence_type text not null default 'observational' check (evidence_type in ('observational','experimental')),
  metric_name text,
  metric_value numeric,
  baseline_value numeric,
  delta_value numeric,
  notes text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists content_os_hypothesis_evidence_hypothesis_idx
  on public.content_os_hypothesis_evidence(hypothesis_id,observed_at desc);

create table if not exists public.content_os_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.content_os_workspaces(id) on delete cascade,
  source_hypothesis_id uuid references public.content_os_hypotheses(id) on delete set null,
  title text not null,
  rule_text text not null,
  rule_type text not null default 'observational' check (rule_type in ('observational','experimental')),
  conditions jsonb not null default '{}'::jsonb,
  target_metric text,
  sample_size integer not null default 0,
  evidence_summary text,
  confidence_level text not null default 'high' check (confidence_level in ('medium','high')),
  confirmed_at timestamptz not null default now(),
  last_validated_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_os_rules_workspace_active_idx
  on public.content_os_rules(workspace_id,active,confirmed_at desc);

alter table public.content_os_hypotheses enable row level security;
alter table public.content_os_hypothesis_evidence enable row level security;
alter table public.content_os_rules enable row level security;

drop trigger if exists set_content_os_hypotheses_updated_at on public.content_os_hypotheses;
create trigger set_content_os_hypotheses_updated_at
before update on public.content_os_hypotheses
for each row execute function public.set_updated_at();

drop trigger if exists set_content_os_rules_updated_at on public.content_os_rules;
create trigger set_content_os_rules_updated_at
before update on public.content_os_rules
for each row execute function public.set_updated_at();

create or replace view public.content_os_analysis_features
with (security_invoker = true) as
select
  c.id as content_id,
  c.workspace_id,
  c.account_id,
  c.platform,
  c.title,
  c.caption,
  c.permalink,
  c.media_type,
  c.media_product_type,
  c.duration_seconds,
  c.published_at,
  cl.element_count,
  cl.hook_type,
  cl.topic,
  cl.main_promise,
  cl.format,
  cl.knowledge_level,
  cl.free_tags,
  lm.captured_at,
  lm.age_minutes,
  lm.views,
  lm.reach,
  lm.likes,
  lm.comments,
  lm.shares,
  lm.saves,
  lm.follows,
  lm.profile_visits,
  lm.total_interactions,
  lm.avg_watch_time_ms,
  lm.retention_rate,
  lm.completion_rate,
  case when coalesce(lm.views,0) > 0 then lm.saves::numeric / lm.views else null end as save_rate,
  case when coalesce(lm.views,0) > 0 then lm.shares::numeric / lm.views else null end as share_rate,
  case when coalesce(lm.views,0) > 0 then lm.comments::numeric / lm.views else null end as comment_rate,
  case when coalesce(lm.views,0) > 0 then lm.follows::numeric / lm.views else null end as follow_rate,
  case when coalesce(lm.views,0) > 0 then lm.profile_visits::numeric / lm.views else null end as profile_visit_rate,
  case when coalesce(lm.reach,0) > 0 then lm.total_interactions::numeric / lm.reach else null end as engagement_rate_reach,
  case when coalesce(lm.profile_visits,0) > 0 then lm.follows::numeric / lm.profile_visits else null end as profile_to_follow_rate,
  case when coalesce(c.duration_seconds,0) > 0 and lm.avg_watch_time_ms is not null
    then (lm.avg_watch_time_ms / 1000.0) / c.duration_seconds else null end as watch_ratio,
  (select count(*) from public.content_os_metric_snapshots sm where sm.content_id = c.id) as snapshot_count
from public.content_os_content c
left join public.content_os_classifications cl on cl.content_id = c.id
left join public.content_os_latest_metrics lm on lm.content_id = c.id;

create or replace view public.content_os_snapshot_milestones
with (security_invoker = true) as
select c.id as content_id, c.workspace_id, t.label as milestone, t.minutes as target_minutes,
       m.id as snapshot_id, m.captured_at, m.age_minutes, m.views, m.reach, m.saves, m.shares,
       m.comments, m.follows, m.profile_visits, m.avg_watch_time_ms, m.retention_rate, m.completion_rate
from public.content_os_content c
cross join (values
  ('1h',60),('3h',180),('6h',360),('12h',720),('24h',1440),('48h',2880),('7d',10080)
) as t(label,minutes)
left join lateral (
  select sm.*
  from public.content_os_metric_snapshots sm
  where sm.content_id = c.id
    and sm.age_minutes is not null
    and abs(sm.age_minutes - t.minutes) <= greatest(30, (t.minutes * 0.20)::int)
  order by abs(sm.age_minutes - t.minutes), sm.captured_at desc
  limit 1
) m on true;

create or replace view public.content_os_velocity_status
with (security_invoker = true) as
with ordered as (
  select
    sm.*,
    lag(sm.views) over (partition by sm.content_id order by sm.captured_at) as prev_views,
    lag(sm.captured_at) over (partition by sm.content_id order by sm.captured_at) as prev_time,
    lag(sm.views,2) over (partition by sm.content_id order by sm.captured_at) as prev2_views,
    lag(sm.captured_at,2) over (partition by sm.content_id order by sm.captured_at) as prev2_time,
    row_number() over (partition by sm.content_id order by sm.captured_at desc) as rn
  from public.content_os_metric_snapshots sm
), rates as (
  select *,
    case when prev_views is not null and extract(epoch from (captured_at-prev_time)) > 0
      then (views-prev_views)::numeric / (extract(epoch from (captured_at-prev_time))/3600.0) end as current_views_per_hour,
    case when prev2_views is not null and prev_views is not null and extract(epoch from (prev_time-prev2_time)) > 0
      then (prev_views-prev2_views)::numeric / (extract(epoch from (prev_time-prev2_time))/3600.0) end as previous_views_per_hour
  from ordered
)
select
  content_id, workspace_id, captured_at, age_minutes, views,
  current_views_per_hour, previous_views_per_hour,
  case
    when previous_views_per_hour is null or current_views_per_hour is null then 'insufficient_data'
    when previous_views_per_hour <= 0 and current_views_per_hour > 0 then 'accelerating'
    when current_views_per_hour >= previous_views_per_hour * 1.20 then 'accelerating'
    when current_views_per_hour <= previous_views_per_hour * 0.80 then 'slowing'
    else 'stable'
  end as velocity_status
from rates
where rn = 1;
