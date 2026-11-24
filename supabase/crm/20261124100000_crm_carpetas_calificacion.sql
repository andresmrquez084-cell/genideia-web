-- CRM GENIDEIA v2 · carpetas, periodo, calificación y verificación por contacto (24/11/2026)
-- Reglas:
--   · periodo "reciente" = último contacto desde el 10/11/2026 (prioridad de trabajo);
--     "historico" = contactado antes (sistemas viejos, Airtable, CRM v1);
--     "nunca_contactado" = cargado y nunca trabajado (ej. leads de e-commerce).
--   · carpeta sale del origen de la importación y se puede cambiar a mano en la ficha.
--   · calificación y verificación se guardan con historial en crm_cambios (igual que el resto).
-- Solo agrega columnas y funciones: no borra ni modifica datos existentes.

-- ---------- columnas nuevas ----------
alter table public.crm_empresas
  add column if not exists carpeta text,
  add column if not exists calificacion text not null default 'sin_calificar'
    check (calificacion in ('A','B','C','D','sin_calificar')),
  add column if not exists calificacion_motivo text,
  add column if not exists calificada_en timestamptz,
  add column if not exists verificacion text not null default 'sin_verificar'
    check (verificacion in ('sin_verificar','whatsapp','email','llamada','ambos')),
  add column if not exists verificado_en timestamptz,
  add column if not exists verificado_fuente text;

create index if not exists crm_empresas_carpeta_idx on public.crm_empresas(carpeta);

-- ---------- carpeta según el origen ----------
create or replace function public.crm_carpeta_de_origen(o text) returns text
language sql immutable as $$
  select case
    when o is null or btrim(o) = '' then 'sin_origen'
    when o ilike 'Leads Ecommerce%' then 'ecommerce_montevideo'
    when o ilike 'Leads Retail%' then 'retail_mayor_montevideo'
    when o ilike 'Leads Transporte%' then 'transporte_sistema_viejo'
    else 'prospeccion_2026'
  end
$$;

update public.crm_empresas set carpeta = public.crm_carpeta_de_origen(origen) where carpeta is null;

-- ---------- vista de empresas: columnas nuevas al final (la lista anterior no cambia) ----------
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
    (select string_agg(concat_ws(' ', k.nombre, k.email, k.telefono), ' ') from public.crm_contactos k where k.empresa_id = e.id)) as busqueda,
  -- columnas nuevas (24/11/2026)
  e.carpeta,
  e.calificacion,
  e.calificacion_motivo,
  e.verificacion,
  e.verificado_en,
  e.verificado_fuente,
  greatest(a.ultimo_saliente, a.ultima_respuesta) as ultimo_contacto,
  case
    when greatest(a.ultimo_saliente, a.ultima_respuesta) >= timestamptz '2026-11-10 00:00:00-03' then 'reciente'
    when a.n_actividades > 0 or coalesce(cv.etapa,'sin_contactar') <> 'sin_contactar' or e.datos_extra->>'contacto_previo' = 'si' then 'historico'
    else 'nunca_contactado'
  end as periodo
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

grant select on public.crm_v_empresas to authenticated, service_role;
revoke all on public.crm_v_empresas from anon;

-- ---------- fijar carpeta, calificación y verificación (con historial) ----------
create or replace function public.crm_fijar_clasificacion(p_empresa uuid, p jsonb) returns jsonb
language plpgsql security invoker as $$
declare
  e public.crm_empresas;
  v_quien text := coalesce(auth.jwt()->>'email', 'api');
  v_nuevo_carpeta text; v_nuevo_cal text; v_nuevo_motivo text; v_nuevo_ver text; v_nuevo_fuente text;
begin
  select * into e from public.crm_empresas where id = p_empresa for update;
  if not found then raise exception 'Empresa inexistente'; end if;

  v_nuevo_carpeta := coalesce(p->>'carpeta', e.carpeta);
  v_nuevo_cal     := coalesce(p->>'calificacion', e.calificacion);
  v_nuevo_motivo  := case when p ? 'calificacion_motivo' then p->>'calificacion_motivo' else e.calificacion_motivo end;
  v_nuevo_ver     := coalesce(p->>'verificacion', e.verificacion);
  v_nuevo_fuente  := case when p ? 'verificado_fuente' then p->>'verificado_fuente' else e.verificado_fuente end;

  if v_nuevo_cal not in ('A','B','C','D','sin_calificar') then raise exception 'Calificación inválida'; end if;
  if v_nuevo_ver not in ('sin_verificar','whatsapp','email','llamada','ambos') then raise exception 'Verificación inválida'; end if;

  -- historial: una fila por campo que cambió
  if v_nuevo_carpeta is distinct from e.carpeta then
    insert into public.crm_cambios(tabla, clave, campo, antes, despues, hecho_por) values ('crm_empresas', e.clave, 'carpeta', to_jsonb(e.carpeta), to_jsonb(v_nuevo_carpeta), v_quien);
  end if;
  if v_nuevo_cal is distinct from e.calificacion or v_nuevo_motivo is distinct from e.calificacion_motivo then
    insert into public.crm_cambios(tabla, clave, campo, antes, despues, hecho_por) values ('crm_empresas', e.clave, 'calificacion', to_jsonb(e.calificacion), to_jsonb(v_nuevo_cal || coalesce(' · ' || v_nuevo_motivo, '')), v_quien);
  end if;
  if v_nuevo_ver is distinct from e.verificacion or v_nuevo_fuente is distinct from e.verificado_fuente then
    insert into public.crm_cambios(tabla, clave, campo, antes, despues, hecho_por) values ('crm_empresas', e.clave, 'verificacion', to_jsonb(e.verificacion), to_jsonb(v_nuevo_ver || coalesce(' · ' || v_nuevo_fuente, '')), v_quien);
  end if;

  update public.crm_empresas set
    carpeta = v_nuevo_carpeta,
    calificacion = v_nuevo_cal,
    calificacion_motivo = v_nuevo_motivo,
    calificada_en = case when v_nuevo_cal is distinct from e.calificacion then now() else e.calificada_en end,
    verificacion = v_nuevo_ver,
    verificado_fuente = v_nuevo_fuente,
    verificado_en = case when v_nuevo_ver is distinct from e.verificacion then now() else e.verificado_en end,
    actualizado_en = now()
  where id = p_empresa;

  return jsonb_build_object('ok', true, 'clave', e.clave);
end $$;

-- ---------- posibles duplicados (se consulta antes de crear una empresa) ----------
create or replace function public.crm_posibles_duplicados(p_nombre text, p_telefono text default null)
returns table(id uuid, clave text, nombre text, pais text, origen text, motivo text)
language sql stable security invoker as $$
  with n as (select public.crm_norm(p_nombre) as nn, right(regexp_replace(coalesce(p_telefono,''), '\D', '', 'g'), 8) as tel8)
  select e.id, e.clave, e.nombre, e.pais, e.origen,
    case when e.nombre_norm = n.nn then 'mismo nombre'
         when length(n.nn) > 3 and (e.nombre_norm like '%' || n.nn || '%' or n.nn like '%' || e.nombre_norm || '%') then 'nombre parecido'
         else 'mismo teléfono' end as motivo
  from public.crm_empresas e, n
  where (length(coalesce(n.nn,'')) > 3 and e.nombre_norm is not null
          and (e.nombre_norm = n.nn or e.nombre_norm like '%' || n.nn || '%' or n.nn like '%' || e.nombre_norm || '%'))
     or (length(coalesce(n.tel8,'')) = 8
          and (right(regexp_replace(coalesce(e.telefono,''), '\D', '', 'g'), 8) = n.tel8
            or right(regexp_replace(coalesce(e.whatsapp,''), '\D', '', 'g'), 8) = n.tel8))
  limit 20
$$;

grant execute on function public.crm_fijar_clasificacion(uuid, jsonb), public.crm_posibles_duplicados(text, text) to authenticated;
revoke execute on function public.crm_fijar_clasificacion(uuid, jsonb), public.crm_posibles_duplicados(text, text) from anon;
grant execute on function public.crm_fijar_clasificacion(uuid, jsonb), public.crm_posibles_duplicados(text, text) to service_role;
