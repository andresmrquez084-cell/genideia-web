-- CRM GENIDEIA · pestaña por asesor (25/11/2026)
-- 1) cada actividad queda atribuida al asesor de su empresa (y puede venir ya con asesor desde una automatización)
-- 2) cada empresa guarda desde cuándo está asignada a su asesor (fecha de asignación)
-- No borra ni cambia datos existentes: las columnas quedan vacías hasta asignar.

alter table public.crm_actividades add column if not exists asesor text;
create index if not exists crm_act_asesor_idx on public.crm_actividades(asesor, fecha_hecho desc);

alter table public.crm_empresas add column if not exists asesor_desde timestamptz;

create or replace function public.crm_actividad_asesor_default() returns trigger
language plpgsql as $$
begin
  if new.asesor is null then
    select e.asesor into new.asesor from public.crm_empresas e where e.id = new.empresa_id;
  end if;
  return new;
end $$;

drop trigger if exists crm_actividad_asesor on public.crm_actividades;
create trigger crm_actividad_asesor before insert on public.crm_actividades
  for each row execute function public.crm_actividad_asesor_default();

create or replace function public.crm_empresa_asesor_desde() returns trigger
language plpgsql as $$
begin
  if new.asesor is distinct from old.asesor then
    new.asesor_desde := case when new.asesor is null then null else now() end;
  end if;
  return new;
end $$;

drop trigger if exists crm_empresa_asesor_desde on public.crm_empresas;
create trigger crm_empresa_asesor_desde before update on public.crm_empresas
  for each row execute function public.crm_empresa_asesor_desde();
