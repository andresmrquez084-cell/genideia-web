-- CRM GENIDEIA v2 · vistas para la interfaz, ficha completa, métricas y exportación.
-- Las vistas usan security_invoker: respetan la misma regla de acceso que las tablas.

-- actividades que cuentan como contacto comercial nuestro / respuesta del prospecto
create or replace function public.crm_es_saliente(tipo text, direccion text) returns boolean
language sql immutable as $$ select direccion = 'saliente' and tipo in ('mensaje','propuesta','material','seguimiento','llamada','reunion') $$;
create or replace function public.crm_es_respuesta(tipo text, direccion text) returns boolean
language sql immutable as $$ select direccion = 'entrante' and tipo in ('respuesta','derivacion','baja','llamada','reunion') $$;

drop view if exists public.crm_v_empresas;
create view public.crm_v_empresas with (security_invoker = true) as
select
  e.id, e.clave, e.nombre, e.grupo, e.rubro, e.pais, e.ciudad, e.web, e.origen, e.responsable,
  e.no_contactar, e.error_canal or exists (select 1 from public.crm_contactos k where k.empresa_id = e.id and k.error_canal) as error_canal,
  e.creado_origen, e.importado_en,
  cv.id as conversacion_id,
  coalesce(cv.etapa, 'sin_contactar') as etapa,
  cv.atencion, cv.canal,
  coalesce(cv.proximo_paso, t.accion) as proxima_accion,
  coalesce(cv.proximo_paso_fecha, t.fecha) as proxima_fecha,
  coalesce(cv.responsable, t.responsable, e.responsable) as responsable_accion,
  a.ultimo_saliente, a.saliente_sin_fecha, a.ultima_respuesta, a.respuesta_sin_fecha, a.n_actividades,
  (a.n_actividades = 0 and (coalesce(cv.etapa,'sin_contactar') <> 'sin_contactar' or e.datos_extra->>'contacto_previo' = 'si')) as sin_desglosar,
  (select count(*) from public.crm_contactos k where k.empresa_id = e.id) as n_contactos,
  (select array_agg(distinct coalesce(f.base, f.sistema)) from public.crm_fuentes f where f.empresa_id = e.id) as bases,
  (select count(*) from public.crm_revision r where r.estado = 'abierta' and (r.entidad_clave = e.clave or r.relacionada_clave = e.clave)) as n_revision,
  concat_ws(' ', e.nombre, e.ciudad, e.pais, e.rubro, e.web, e.telefono,
    (select string_agg(concat_ws(' ', k.nombre, k.email, k.telefono), ' ') from public.crm_contactos k where k.empresa_id = e.id)) as busqueda
from public.crm_empresas e
left join lateral (
  select * from public.crm_conversaciones c where c.empresa_id = e.id
  order by (c.etapa in ('ganado','perdido')), c.actualizado_en desc limit 1
) cv on true
left join lateral (
  select accion, fecha, responsable from public.crm_tareas x
  where x.empresa_id = e.id and x.estado = 'pendiente' order by x.fecha nulls last limit 1
) t on true
left join lateral (
  select
    max(fecha_hecho) filter (where public.crm_es_saliente(tipo, direccion)) as ultimo_saliente,
    bool_or(fecha_hecho is null and public.crm_es_saliente(tipo, direccion)) as saliente_sin_fecha,
    max(fecha_hecho) filter (where public.crm_es_respuesta(tipo, direccion)) as ultima_respuesta,
    bool_or(fecha_hecho is null and public.crm_es_respuesta(tipo, direccion)) as respuesta_sin_fecha,
    count(*) as n_actividades
  from public.crm_actividades x where x.empresa_id = e.id
) a on true;

drop view if exists public.crm_v_conversaciones;
create view public.crm_v_conversaciones with (security_invoker = true) as
select
  c.id, c.clave, c.empresa_id, e.nombre as empresa, e.clave as empresa_clave, e.pais, e.rubro,
  c.canal, c.objetivo, c.solucion_interes, c.etapa, c.atencion, c.responsable, c.valor, c.moneda,
  coalesce(c.proximo_paso, t.accion) as proxima_accion,
  coalesce(c.proximo_paso_fecha, t.fecha) as proxima_fecha,
  a.ultimo_saliente, a.ultima_respuesta, a.ultimo_texto, a.ultimo_dir, a.n_actividades,
  e.no_contactar, e.error_canal,
  (select string_agg(k.nombre, ', ') from public.crm_conversacion_contactos cc join public.crm_contactos k on k.id = cc.contacto_id where cc.conversacion_id = c.id) as contactos,
  case
    when c.atencion = 'cerrado' or c.etapa in ('ganado','perdido') then 9
    when c.atencion = 'nos_toca_responder' then 1
    when coalesce(c.proximo_paso_fecha, t.fecha) < current_date then 2
    when c.atencion = 'esperando_derivacion' then 3
    when c.atencion = 'seguimiento_programado' then 4
    when c.atencion = 'esperando_prospecto' then 5
    when c.atencion = 'pausado' then 6
    else 7 end as prioridad,
  c.actualizado_en
from public.crm_conversaciones c
join public.crm_empresas e on e.id = c.empresa_id
left join lateral (
  select accion, fecha from public.crm_tareas x where x.empresa_id = c.empresa_id and x.estado = 'pendiente'
    and (x.conversacion_id = c.id or x.conversacion_id is null) order by x.fecha nulls last limit 1
) t on true
left join lateral (
  select
    max(fecha_hecho) filter (where public.crm_es_saliente(tipo, direccion)) as ultimo_saliente,
    max(fecha_hecho) filter (where public.crm_es_respuesta(tipo, direccion)) as ultima_respuesta,
    (array_agg(left(coalesce(asunto, texto), 160) order by fecha_hecho desc nulls last))[1] as ultimo_texto,
    (array_agg(direccion order by fecha_hecho desc nulls last))[1] as ultimo_dir,
    count(*) as n_actividades
  from public.crm_actividades x where x.empresa_id = c.empresa_id and (x.conversacion_id = c.id or x.conversacion_id is null)
) a on true;

drop view if exists public.crm_v_tareas;
create view public.crm_v_tareas with (security_invoker = true) as
select t.*, e.nombre as empresa, e.clave as empresa_clave
from public.crm_tareas t join public.crm_empresas e on e.id = t.empresa_id;

drop view if exists public.crm_v_tandas;
create view public.crm_v_tandas with (security_invoker = true) as
select t.*,
  (select count(distinct coalesce(p.contacto_id::text, p.empresa_id::text)) from public.crm_tanda_participantes p where p.tanda_id = t.id) as contactos_unicos,
  (select count(*) from public.crm_tanda_participantes p where p.tanda_id = t.id) as intentos,
  (select count(*) from public.crm_tanda_participantes p where p.tanda_id = t.id and p.es_reposicion) as reposiciones,
  (select count(*) from public.crm_actividades a where a.tanda_id = t.id and a.estado_envio = 'rebotado') as rebotes,
  (select count(*) from public.crm_actividades a where a.tanda_id = t.id and a.estado_envio in ('envio_confirmado','sin_error_al_corte')) as sin_error,
  (select count(distinct r.empresa_id) from public.crm_actividades r
     where r.direccion = 'entrante' and r.tipo in ('respuesta','derivacion','baja') and r.estado_envio is distinct from 'respuesta_automatica'
       and r.empresa_id in (select p.empresa_id from public.crm_tanda_participantes p where p.tanda_id = t.id)) as respondieron
from public.crm_tandas t;

-- ficha completa de una empresa (una sola llamada, el texto largo solo se trae acá)
create or replace function public.crm_ficha(p_empresa uuid) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'empresa', (select to_jsonb(e) from public.crm_empresas e where e.id = p_empresa),
    'vista', (select to_jsonb(v) - 'busqueda' from public.crm_v_empresas v where v.id = p_empresa),
    'contactos', coalesce((select jsonb_agg(to_jsonb(k) order by k.nombre) from public.crm_contactos k where k.empresa_id = p_empresa), '[]'),
    'conversaciones', coalesce((select jsonb_agg(to_jsonb(c) || jsonb_build_object('contactos',
        coalesce((select jsonb_agg(cc.contacto_id) from public.crm_conversacion_contactos cc where cc.conversacion_id = c.id), '[]'))
        order by c.actualizado_en desc) from public.crm_conversaciones c where c.empresa_id = p_empresa), '[]'),
    'actividades', coalesce((select jsonb_agg(to_jsonb(a) order by a.fecha_hecho desc nulls last, a.fecha_reporte desc nulls last)
        from public.crm_actividades a where a.empresa_id = p_empresa), '[]'),
    'materiales', coalesce((select jsonb_agg(to_jsonb(m) order by m.enviado_en desc nulls last) from public.crm_materiales m where m.empresa_id = p_empresa), '[]'),
    'tareas', coalesce((select jsonb_agg(to_jsonb(t) order by t.estado, t.fecha nulls last) from public.crm_tareas t where t.empresa_id = p_empresa), '[]'),
    'fuentes', coalesce((select jsonb_agg(to_jsonb(f) order by f.creado_origen nulls last) from public.crm_fuentes f where f.empresa_id = p_empresa), '[]'),
    'tandas', coalesce((select jsonb_agg(jsonb_build_object('tanda', t.nombre, 'variante', p.variante, 'intento', p.intento, 'reposicion', p.es_reposicion, 'reemplaza', p.reemplaza, 'resultado', p.resultado))
        from public.crm_tanda_participantes p join public.crm_tandas t on t.id = p.tanda_id where p.empresa_id = p_empresa), '[]'),
    'revision', coalesce((select jsonb_agg(to_jsonb(r) order by r.creado_en desc) from public.crm_revision r
        where r.entidad_clave = (select clave from public.crm_empresas where id = p_empresa)
           or r.relacionada_clave = (select clave from public.crm_empresas where id = p_empresa)), '[]'),
    'cambios', coalesce((select jsonb_agg(to_jsonb(x) order by x.hecho_en desc) from (select * from public.crm_cambios
        where clave = (select clave from public.crm_empresas where id = p_empresa) order by hecho_en desc limit 50) x), '[]')
  )
$$;

-- métricas: contactos únicos, intentos y reposiciones separados; comparaciones con ventana igual
create or replace function public.crm_metricas(p_ventana_dias int default 3) returns jsonb
language sql stable security invoker set search_path = public as $$
with env as (
  select a.*, (a.fecha_hecho at time zone 'America/Montevideo') as local
  from public.crm_actividades a where a.direccion = 'saliente' and a.tipo = 'mensaje'
), resp as (
  select * from public.crm_actividades a
  where a.direccion = 'entrante' and a.tipo in ('respuesta','derivacion','baja') and a.estado_envio is distinct from 'respuesta_automatica'
), obs as (
  -- solo envíos con fecha exacta y la ventana completa transcurrida
  select e.*, exists (select 1 from resp r where r.empresa_id = e.empresa_id and r.fecha_hecho >= e.fecha_hecho
                        and r.fecha_hecho < e.fecha_hecho + make_interval(days => p_ventana_dias)) as respondio
  from env e where e.fecha_hecho is not null and e.fecha_precision = 'exacta'
    and e.fecha_hecho <= now() - make_interval(days => p_ventana_dias) and e.estado_envio is distinct from 'rebotado'
)
select jsonb_build_object(
  'ventana_dias', p_ventana_dias,
  'empresas', (select count(*) from public.crm_empresas),
  'empresas_contactadas', (select count(distinct empresa_id) from env),
  'contactos_unicos', (select count(distinct coalesce(contacto_id::text, empresa_id::text)) from env),
  'intentos', (select count(*) from env),
  'reposiciones', (select count(*) from env where es_reposicion),
  'por_canal', coalesce((select jsonb_object_agg(coalesce(canal,'Sin dato'), n) from (select canal, count(*) n from env group by 1) x), '{}'),
  'estado_envio', coalesce((select jsonb_object_agg(coalesce(estado_envio,'sin_dato'), n) from (select estado_envio, count(*) n from env group by 1) x), '{}'),
  'respuestas_humanas', (select count(*) from resp),
  'empresas_que_respondieron', (select count(distinct empresa_id) from resp),
  'primeras_respuestas', (select count(*) from resp where primera_respuesta),
  'clasificacion', coalesce((select jsonb_object_agg(coalesce(clasificacion,'sin_clasificar'), n) from (select clasificacion, count(*) n from resp group by 1) x), '{}'),
  'respuestas_automaticas', (select count(*) from public.crm_actividades where estado_envio = 'respuesta_automatica' and direccion = 'entrante'),
  'rebotes', (select count(*) from public.crm_actividades where tipo = 'rebote' or (direccion = 'saliente' and estado_envio = 'rebotado')),
  'etapas', coalesce((select jsonb_object_agg(etapa, n) from (select etapa, count(*) n from public.crm_v_empresas group by 1) x), '{}'),
  'atencion', coalesce((select jsonb_object_agg(coalesce(atencion,'sin_definir'), n) from (select atencion, count(*) n from public.crm_conversaciones where etapa not in ('ganado','perdido') group by 1) x), '{}'),
  'no_contactar', (select count(*) from public.crm_empresas where no_contactar) + (select count(*) from public.crm_contactos where no_contactar),
  'error_canal', (select count(*) from public.crm_empresas where error_canal) + (select count(*) from public.crm_contactos where error_canal),
  'sin_desglosar', (select count(*) from public.crm_v_empresas where sin_desglosar),
  'por_variante', coalesce((select jsonb_agg(jsonb_build_object('grupo', coalesce(variante,'Sin variante'), 'n', n, 'respondieron', r, 'muestra_chica', n < 30) order by n desc)
      from (select variante, count(*) n, count(*) filter (where respondio) r from obs group by 1) x), '[]'),
  'por_franja', coalesce((select jsonb_agg(jsonb_build_object('grupo', f, 'n', n, 'respondieron', r, 'muestra_chica', n < 30) order by f)
      from (select case when extract(hour from local) < 12 then '1 · mañana (antes de 12)' when extract(hour from local) < 15 then '2 · mediodía (12 a 15)' else '3 · tarde (desde 15)' end f,
                   count(*) n, count(*) filter (where respondio) r from obs group by 1) x), '[]'),
  'por_tanda', coalesce((select jsonb_agg(to_jsonb(t) order by t.fecha desc nulls last) from public.crm_v_tandas t), '[]'),
  'observados', (select count(*) from obs)
)
$$;

-- exportación completa en el mismo formato que la importación (reimportable sin duplicar)
create or replace function public.crm_exportar() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'formato', 'genideia-crm/2', 'exportado_en', now(),
    'empresas', coalesce((select jsonb_agg(to_jsonb(e) - 'id' - 'nombre_norm') from public.crm_empresas e), '[]'),
    'tandas', coalesce((select jsonb_agg(to_jsonb(t) - 'id') from public.crm_tandas t), '[]'),
    'fuentes', coalesce((select jsonb_agg(to_jsonb(f) - 'id' - 'empresa_id' || jsonb_build_object('empresa', e.clave)) from public.crm_fuentes f left join public.crm_empresas e on e.id = f.empresa_id), '[]'),
    'contactos', coalesce((select jsonb_agg(to_jsonb(k) - 'id' - 'empresa_id' || jsonb_build_object('empresa', e.clave)) from public.crm_contactos k join public.crm_empresas e on e.id = k.empresa_id), '[]'),
    'conversaciones', coalesce((select jsonb_agg(to_jsonb(c) - 'id' - 'empresa_id' || jsonb_build_object('empresa', e.clave,
        'contactos', coalesce((select jsonb_agg(k.clave) from public.crm_conversacion_contactos cc join public.crm_contactos k on k.id = cc.contacto_id where cc.conversacion_id = c.id), '[]')))
        from public.crm_conversaciones c join public.crm_empresas e on e.id = c.empresa_id), '[]'),
    'actividades', coalesce((select jsonb_agg(to_jsonb(a) - 'id' - 'empresa_id' - 'conversacion_id' - 'contacto_id' - 'tanda_id' - 'fuente_id' - 'responde_a' || jsonb_strip_nulls(jsonb_build_object(
        'empresa', e.clave, 'conversacion', c.clave, 'contacto', k.clave, 'tanda', t.clave, 'fuente', f.clave, 'responde_a', r.clave)))
        from public.crm_actividades a join public.crm_empresas e on e.id = a.empresa_id
        left join public.crm_conversaciones c on c.id = a.conversacion_id left join public.crm_contactos k on k.id = a.contacto_id
        left join public.crm_tandas t on t.id = a.tanda_id left join public.crm_fuentes f on f.id = a.fuente_id
        left join public.crm_actividades r on r.id = a.responde_a), '[]'),
    'materiales', coalesce((select jsonb_agg(to_jsonb(m) - 'id' - 'empresa_id' - 'conversacion_id' - 'contacto_id' - 'actividad_id' - 'respuesta_actividad_id' || jsonb_strip_nulls(jsonb_build_object(
        'empresa', e.clave, 'conversacion', c.clave, 'contacto', k.clave, 'actividad', a.clave, 'respuesta_actividad', r.clave)))
        from public.crm_materiales m join public.crm_empresas e on e.id = m.empresa_id
        left join public.crm_conversaciones c on c.id = m.conversacion_id left join public.crm_contactos k on k.id = m.contacto_id
        left join public.crm_actividades a on a.id = m.actividad_id left join public.crm_actividades r on r.id = m.respuesta_actividad_id), '[]'),
    'tareas', coalesce((select jsonb_agg(to_jsonb(t) - 'id' - 'empresa_id' - 'conversacion_id' || jsonb_strip_nulls(jsonb_build_object('empresa', e.clave, 'conversacion', c.clave)))
        from public.crm_tareas t join public.crm_empresas e on e.id = t.empresa_id left join public.crm_conversaciones c on c.id = t.conversacion_id), '[]'),
    'participaciones', coalesce((select jsonb_agg(to_jsonb(p) - 'id' - 'tanda_id' - 'empresa_id' - 'contacto_id' - 'actividad_id' || jsonb_strip_nulls(jsonb_build_object(
        'tanda', t.clave, 'empresa', e.clave, 'contacto', k.clave, 'actividad', a.clave)))
        from public.crm_tanda_participantes p join public.crm_tandas t on t.id = p.tanda_id join public.crm_empresas e on e.id = p.empresa_id
        left join public.crm_contactos k on k.id = p.contacto_id left join public.crm_actividades a on a.id = p.actividad_id), '[]'),
    'ejecuciones', coalesce((select jsonb_agg(to_jsonb(x) - 'id') from public.crm_ejecuciones x), '[]'),
    'revision', coalesce((select jsonb_agg(to_jsonb(r) - 'id') from public.crm_revision r), '[]')
  )
$$;

revoke execute on function public.crm_ficha(uuid), public.crm_metricas(int), public.crm_exportar() from anon;
grant execute on function public.crm_ficha(uuid), public.crm_metricas(int), public.crm_exportar() to authenticated;
grant select on public.crm_v_empresas, public.crm_v_conversaciones, public.crm_v_tareas, public.crm_v_tandas to authenticated;
revoke all on public.crm_v_empresas, public.crm_v_conversaciones, public.crm_v_tareas, public.crm_v_tandas from anon;

-- la API (edge function crm-api) usa service_role: en este proyecto no tiene permisos por defecto
grant select, insert, update, delete on public.crm_importaciones, public.crm_empresas, public.crm_contactos, public.crm_conversaciones,
  public.crm_conversacion_contactos, public.crm_tandas, public.crm_fuentes, public.crm_actividades, public.crm_materiales, public.crm_tareas,
  public.crm_tanda_participantes, public.crm_ejecuciones, public.crm_revision, public.crm_cambios, public.crm_api_keys to service_role;
grant select on public.crm_v_empresas, public.crm_v_conversaciones, public.crm_v_tareas, public.crm_v_tandas to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.crm_importar(jsonb, boolean, text, text), public.crm_ficha(uuid), public.crm_metricas(int), public.crm_exportar() to service_role;
