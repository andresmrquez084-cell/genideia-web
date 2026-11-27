-- CRM GENIDEIA · validación y distribución de la cartera histórica (27/11/2026)
-- Solo agrega columnas y una vista; corrige el cálculo de tel_digitos (dato derivado, no histórico).
-- Reversión: drop de las columnas validacion*, canales, canal_preferente, captado_por, asignacion_criterio y de crm_v_cartera.

-- ---------- 1. teléfono para deduplicar ----------
-- Antes: tel_digitos tomaba los últimos 8 dígitos de todo el texto. En 2.533 empresas `telefono` guarda un enlace
-- "https://wa.me/598…?text=Hola%2C%20…" y los dígitos del texto codificado ("%20", "%2C", "%3F") daban "02020203"
-- para 2.141 empresas distintas: falsos duplicados por teléfono (y falsos choques en el freno de asesor).
-- Ahora: si hay un enlace de WhatsApp se usa el número del enlace (sin número → vacío); si no, los dígitos del teléfono.
create or replace function public.crm_tel_digitos(t text) returns text
language sql immutable parallel safe as $$
  select case when n is not null and length(n) >= 8 then right(n, 8) end
  from (select case when coalesce(t,'') ~* '(wa\.me|whatsapp\.com)/' then substring(t from '(?:wa\.me/|phone=)(\d{6,})')
                    else regexp_replace(coalesce(t,''), '\D', '', 'g') end as n) x
$$;
-- Dominio de la web para deduplicar. Antes la exclusión exigía un punto después del nombre ("wa.me." ) y no
-- reconocía "https://wa.me/…": las webs que son un enlace de WhatsApp quedaban con dominio "wa.me" y se emparejaban.
create or replace function public.crm_web_dominio(w text) returns text
language sql immutable parallel safe as $$
  select case when w is null or w ~* '(^|[/.@])(instagram\.com|facebook\.com|fb\.com|google\.|goo\.gl|linktr\.ee|wa\.me|whatsapp\.com|mercadolibre\.|wixsite\.com|business\.site|tiktok\.com|kyte\.site)' then null
    else nullif(lower(regexp_replace(regexp_replace(w,'^https?://(www\.)?',''),'[/?#].*$','')), '') end
$$;
create or replace function public.crm_empresas_norm() returns trigger language plpgsql as $$
begin
  new.nombre_norm := public.crm_norm(new.nombre);
  new.web_dominio := public.crm_web_dominio(new.web);
  new.tel_digitos := public.crm_tel_digitos(new.telefono);
  return new;
end $$;

alter table public.crm_empresas disable trigger crm_empresas_touch;
update public.crm_empresas set tel_digitos = public.crm_tel_digitos(telefono), web_dominio = public.crm_web_dominio(web)
  where tel_digitos is distinct from public.crm_tel_digitos(telefono) or web_dominio is distinct from public.crm_web_dominio(web);
alter table public.crm_empresas enable trigger crm_empresas_touch;

-- ---------- 2. validación comercial ----------
-- validacion: aprobado · pendiente_verificacion · no_calificado · duplicado · no_contactar · revision_necesaria
-- canales (jsonb): {"whatsapp": {"estado","valor","fuente","fecha","nota"}, "email": {…, "tipo"}, "instagram": {…}}
--   estado por canal: verificado · pendiente · no_disponible · no_apto
alter table public.crm_empresas
  add column if not exists validacion text,
  add column if not exists validacion_motivo text,
  add column if not exists validacion_evidencia text,
  add column if not exists validado_en timestamptz,
  add column if not exists validado_por text,
  add column if not exists validacion_lote text,
  add column if not exists canales jsonb not null default '{}'::jsonb,
  add column if not exists canal_preferente text,
  add column if not exists captado_por text,
  add column if not exists asignacion_criterio text;
alter table public.crm_empresas drop constraint if exists crm_empresas_validacion_check;
alter table public.crm_empresas add constraint crm_empresas_validacion_check check (validacion in
  ('aprobado','pendiente_verificacion','no_calificado','duplicado','no_contactar','revision_necesaria'));
create index if not exists crm_empresas_validacion_idx on public.crm_empresas(validacion, asesor);

-- ---------- 3. cartera: estado de contacto derivado (no se guarda a mano) ----------
-- aprobado_disponible: aprobada y sin asesor · asignado_sin_contactar: con asesor y sin ningún mensaje nuestro registrado
-- contactado: hay al menos un mensaje saliente registrado
create or replace view public.crm_v_cartera with (security_invoker = true) as
select e.id, e.clave, e.nombre, e.nicho, e.rubro, e.pais, e.ciudad, e.web, e.origen, e.carpeta,
  e.validacion, e.validacion_motivo, e.validacion_evidencia, e.validado_en, e.validado_por, e.validacion_lote,
  e.canales, e.canal_preferente, e.captado_por, e.asesor, e.asesor_desde, e.asignacion_criterio, e.instagram_usuario, e.no_contactar,
  e.datos_extra->>'mensaje_sugerido' as mensaje_sugerido,
  e.datos_extra->>'mensaje_instagram' as mensaje_instagram,
  e.datos_extra->>'actividad_verificada' as actividad_verificada,
  case
    when e.validacion is distinct from 'aprobado' then null
    when exists (select 1 from public.crm_actividades a where a.empresa_id = e.id and a.direccion = 'saliente' and a.tipo = 'mensaje') then 'contactado'
    when e.asesor is null then 'aprobado_disponible'
    else 'asignado_sin_contactar' end as estado_contacto,
  e.datos_extra->>'mensaje_sugerido_estado' as mensaje_sugerido_estado
from public.crm_empresas e
where e.validacion is not null;
revoke all on public.crm_v_cartera from anon;
grant select on public.crm_v_cartera to authenticated, service_role;
