-- CRM GENIDEIA · lista de asesor (25/11/2026)
-- Agrega una marca de asesor a cada empresa para separar la prospección de Andrés y la de Agustín.
-- No cambia asignaciones, permisos ni datos existentes: la columna queda vacía (sin asesor) salvo que se asigne a mano.

alter table public.crm_empresas add column if not exists asesor text;
create index if not exists crm_empresas_asesor_idx on public.crm_empresas(asesor);

-- la vista suma la columna asesor y conserva todo lo anterior (incluidos nicho y nicho_fuente)
drop view if exists public.crm_v_empresas;
create view public.crm_v_empresas with (security_invoker = true) as
select
  e.id, e.clave, e.nombre, e.grupo, e.rubro, e.nicho, e.nicho_fuente, e.pais, e.ciudad, e.web, e.origen, e.responsable,
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
  concat_ws(' ', e.nombre, e.ciudad, e.pais, e.rubro, e.nicho, e.web, e.telefono,
    (select string_agg(concat_ws(' ', k.nombre, k.email, k.telefono), ' ') from public.crm_contactos k where k.empresa_id = e.id)) as busqueda,
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
  end as periodo,
  e.asesor
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

-- la clasificación también guarda el asesor (misma lógica que antes, con historial)
create or replace function public.crm_fijar_clasificacion(p_empresa uuid, p jsonb) returns jsonb
language plpgsql security invoker as $$
declare
  e public.crm_empresas;
  v_quien text := coalesce(auth.jwt()->>'email', 'api');
  v_carpeta text; v_cal text; v_motivo text; v_ver text; v_fuente text; v_asesor text;
begin
  select * into e from public.crm_empresas where id = p_empresa for update;
  if not found then raise exception 'Empresa inexistente'; end if;
  v_carpeta := coalesce(p->>'carpeta', e.carpeta);
  v_cal     := coalesce(p->>'calificacion', e.calificacion);
  v_motivo  := case when p ? 'calificacion_motivo' then p->>'calificacion_motivo' else e.calificacion_motivo end;
  v_ver     := coalesce(p->>'verificacion', e.verificacion);
  v_fuente  := case when p ? 'verificado_fuente' then p->>'verificado_fuente' else e.verificado_fuente end;
  v_asesor  := case when p ? 'asesor' then nullif(p->>'asesor','') else e.asesor end;
  if v_cal not in ('A','B','C','D','sin_calificar') then raise exception 'Calificación inválida'; end if;
  if v_ver not in ('sin_verificar','whatsapp','email','llamada','ambos') then raise exception 'Verificación inválida'; end if;
  if v_carpeta is distinct from e.carpeta then
    insert into public.crm_cambios(tabla, clave, campo, antes, despues, hecho_por) values ('crm_empresas', e.clave, 'carpeta', to_jsonb(e.carpeta), to_jsonb(v_carpeta), v_quien);
  end if;
  if v_cal is distinct from e.calificacion or v_motivo is distinct from e.calificacion_motivo then
    insert into public.crm_cambios(tabla, clave, campo, antes, despues, hecho_por) values ('crm_empresas', e.clave, 'calificacion', to_jsonb(e.calificacion), to_jsonb(v_cal || coalesce(' · ' || v_motivo, '')), v_quien);
  end if;
  if v_ver is distinct from e.verificacion or v_fuente is distinct from e.verificado_fuente then
    insert into public.crm_cambios(tabla, clave, campo, antes, despues, hecho_por) values ('crm_empresas', e.clave, 'verificacion', to_jsonb(e.verificacion), to_jsonb(v_ver || coalesce(' · ' || v_fuente, '')), v_quien);
  end if;
  if v_asesor is distinct from e.asesor then
    insert into public.crm_cambios(tabla, clave, campo, antes, despues, hecho_por) values ('crm_empresas', e.clave, 'asesor', to_jsonb(e.asesor), to_jsonb(v_asesor), v_quien);
  end if;
  update public.crm_empresas set
    carpeta = v_carpeta,
    calificacion = v_cal,
    calificacion_motivo = v_motivo,
    calificada_en = case when v_cal is distinct from e.calificacion then now() else e.calificada_en end,
    verificacion = v_ver,
    verificado_fuente = v_fuente,
    verificado_en = case when v_ver is distinct from e.verificacion then now() else e.verificado_en end,
    asesor = v_asesor,
    actualizado_en = now()
  where id = p_empresa;
  return jsonb_build_object('ok', true, 'clave', e.clave);
end $$;
