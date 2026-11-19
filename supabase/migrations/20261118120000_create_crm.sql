-- CRM GENIDEIA: empresas e interacciones. Solo administradores (gen_hub_is_admin).
-- Cada fila guarda el objeto completo en data (jsonb); las columnas sueltas sirven para filtrar.

create table if not exists public.crm_companies (
  id text primary key,
  name text generated always as (data->>'name') stored,
  stage text generated always as (data->>'stage') stored,
  data jsonb not null,
  creado_en timestamp with time zone not null default now(),
  actualizado_en timestamp with time zone not null default now(),
  actualizado_por uuid default auth.uid()
);

create table if not exists public.crm_interactions (
  id text primary key,
  company_id text not null references public.crm_companies(id) on delete cascade,
  data jsonb not null,
  creado_en timestamp with time zone not null default now(),
  actualizado_en timestamp with time zone not null default now(),
  actualizado_por uuid default auth.uid()
);

create index if not exists crm_companies_stage_idx on public.crm_companies(stage);
create index if not exists crm_interactions_company_idx on public.crm_interactions(company_id);

alter table public.crm_companies enable row level security;
alter table public.crm_interactions enable row level security;

drop policy if exists crm_companies_admin on public.crm_companies;
create policy crm_companies_admin
on public.crm_companies for all to authenticated
using (gen_hub_is_admin())
with check (gen_hub_is_admin());

drop policy if exists crm_interactions_admin on public.crm_interactions;
create policy crm_interactions_admin
on public.crm_interactions for all to authenticated
using (gen_hub_is_admin())
with check (gen_hub_is_admin());

revoke all on public.crm_companies, public.crm_interactions from anon;
grant select, insert, update, delete on public.crm_companies, public.crm_interactions to authenticated;
