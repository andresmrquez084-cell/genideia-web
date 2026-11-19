-- CRM GENIDEIA. Proyecto Supabase propio (fzrrbqqvteyuwbvfgvnx), separado de la base de clientes.
-- Solo entran los emails listados en crm_admins.

create table if not exists public.crm_admins (
  email text primary key
);

create or replace function public.crm_is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.crm_admins
    where lower(email) = lower(coalesce(auth.jwt()->>'email',''))
  );
$$;

create table if not exists public.crm_companies (
  id text primary key,
  name text generated always as (data->>'name') stored,
  stage text generated always as (data->>'stage') stored,
  data jsonb not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid default auth.uid()
);

create table if not exists public.crm_interactions (
  id text primary key,
  company_id text not null references public.crm_companies(id) on delete cascade,
  data jsonb not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid default auth.uid()
);

create index if not exists crm_companies_stage_idx on public.crm_companies(stage);
create index if not exists crm_interactions_company_idx on public.crm_interactions(company_id);

alter table public.crm_admins enable row level security;
alter table public.crm_companies enable row level security;
alter table public.crm_interactions enable row level security;

drop policy if exists crm_admins_self on public.crm_admins;
create policy crm_admins_self on public.crm_admins
  for select to authenticated using (public.crm_is_admin());

drop policy if exists crm_companies_admin on public.crm_companies;
create policy crm_companies_admin on public.crm_companies
  for all to authenticated
  using (public.crm_is_admin()) with check (public.crm_is_admin());

drop policy if exists crm_interactions_admin on public.crm_interactions;
create policy crm_interactions_admin on public.crm_interactions
  for all to authenticated
  using (public.crm_is_admin()) with check (public.crm_is_admin());

revoke all on public.crm_admins, public.crm_companies, public.crm_interactions from anon;
grant select on public.crm_admins to authenticated;
grant select, insert, update, delete on public.crm_companies, public.crm_interactions to authenticated;
revoke execute on function public.crm_is_admin() from anon;

-- Quién puede entrar. Ya corrido en el proyecto con este email.
insert into public.crm_admins (email) values
  ('genideiaconsultoriaia@gmail.com')
on conflict do nothing;
