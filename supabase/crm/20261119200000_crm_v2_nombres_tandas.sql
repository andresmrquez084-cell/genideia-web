-- Títulos legibles para las tandas. El nombre tal como venía del origen queda en nombre_origen.
alter table public.crm_tandas add column if not exists nombre_origen text;
update public.crm_tandas set nombre_origen = nombre where nombre_origen is null;
update public.crm_tandas t set nombre = x.titulo from (values
  ('EMAIL-20261118-MEDIODIA',            'Tanda del mediodía'),
  ('2026-11-18 inicial',                 'Tanda inicial'),
  ('2026-11-18 adicional mañana',        'Adicional de la mañana'),
  ('2026-11-18 inicial — reposición',    'Reposiciones de la tanda inicial'),
  ('2026-11-18 adicional — reposición',  'Reposiciones de la adicional'),
  ('2026-11-19 12:00',                   'Tanda de las 12:00')
) x(origen, titulo) where t.nombre_origen = x.origen;
drop view if exists public.crm_v_tandas;
create view public.crm_v_tandas with (security_invoker = true) as
select t.id, t.clave, t.nombre, t.nombre_origen, t.fecha, t.canal, t.responsable, t.variantes, t.notas,
  coalesce((select jsonb_object_agg(n, c) from (select coalesce(e.nicho,'Otros') n, count(*) c from public.crm_tanda_participantes p join public.crm_empresas e on e.id = p.empresa_id where p.tanda_id = t.id group by 1) x), '{}') as distribucion,
  (select count(distinct coalesce(p.contacto_id::text, p.empresa_id::text)) from public.crm_tanda_participantes p where p.tanda_id = t.id) as contactos_unicos,
  (select count(*) from public.crm_tanda_participantes p where p.tanda_id = t.id) as intentos,
  (select count(*) from public.crm_tanda_participantes p where p.tanda_id = t.id and p.es_reposicion) as reposiciones,
  (select count(*) from public.crm_actividades a where a.tanda_id = t.id and a.estado_envio = 'rebotado' and a.direccion = 'saliente') as rebotes,
  (select count(*) from public.crm_actividades a where a.tanda_id = t.id and a.estado_envio in ('envio_confirmado','sin_error_al_corte') and a.direccion = 'saliente') as sin_error,
  (select count(distinct r.empresa_id) from public.crm_actividades r
     where r.direccion = 'entrante' and r.tipo in ('respuesta','derivacion','baja') and r.estado_envio is distinct from 'respuesta_automatica'
       and r.empresa_id in (select p.empresa_id from public.crm_tanda_participantes p where p.tanda_id = t.id)) as respondieron
from public.crm_tandas t;

grant select on public.crm_v_tandas to authenticated, service_role;
revoke all on public.crm_v_tandas from anon;
