-- CRM GENIDEIA v2 · nichos.
-- Cada empresa tiene un nicho canónico y de dónde salió: 'registro' (campo Nicho del envío),
-- 'rubro' (regla sobre el rubro), 'base' (nombre de la base de origen) o 'manual' (lo eligió una persona).

create or replace function public.crm_nicho_regla(t text) returns text
language sql immutable as $$
  select case
    when t is null or t = '' then null
    when t ~ '(restaurant|rotiser|comida|gastronom|parrilla|pizzer|cafeter|bar )' then 'Restaurantes'
    when t ~ '(odontolog|dental|dentist)' then 'Clínicas odontológicas'
    when t ~ '(taller|automotr|mecanic|neumatic|chapa)' then 'Talleres mecánicos'
    when t ~ '(gimnas|gym|fitness|crossfit)' then 'Gimnasios'
    when t ~ '(aduan|despachant|comercio exterior)' then 'Aduanas y comercio exterior'
    when t ~ '(logistic|transporte|carga|flete|camion|mudanza|cadeter|courier|envios|deposito)' then 'Transporte y logística'
    when t ~ '(agro|granos|cereal|frigorific|exportador)' then 'Agro y agroexportación'
    when t ~ '(distribuidor|mayorist|importador|bebidas)' then 'Distribución y mayoristas'
    when t ~ '(juridic|abogac|legal|escriban|notari)' then 'Servicios jurídicos'
    when t ~ '(inmobiliari|propiedades|hipotecari)' then 'Inmobiliarias'
    when t ~ '(supermercad|almacen|autoservicio|minimercado|retail)' then 'Retail y supermercados'
    when t ~ '(ecommerce|e commerce|tienda|boutique|indumentaria|ropa|calzado|informatica|electro|jugueter|libreri|perfumer|optica|farmac)' then 'Comercios y ecommerce'
    else null end
$$;

alter table public.crm_empresas add column if not exists nicho text, add column if not exists nicho_fuente text
  check (nicho_fuente in ('registro','rubro','base','manual'));
create index if not exists crm_empresas_nicho_idx on public.crm_empresas(nicho);

-- asignación automática al crear o cambiar rubro (si nadie lo fijó a mano)
create or replace function public.crm_empresas_nicho() returns trigger language plpgsql as $$
declare r text;
begin
  if new.nicho is not null and (tg_op = 'INSERT' or new.nicho is distinct from old.nicho) then
    new.nicho_fuente := coalesce(new.nicho_fuente, 'manual'); return new;
  end if;
  if new.nicho_fuente in ('manual','registro') then return new; end if;
  r := public.crm_nicho_regla(public.crm_norm(new.rubro));
  if r is not null then new.nicho := r; new.nicho_fuente := 'rubro'; return new; end if;
  r := public.crm_nicho_regla(public.crm_norm(new.origen));
  if r is not null then new.nicho := r; new.nicho_fuente := 'base';
  else new.nicho := coalesce(new.nicho, 'Otros'); new.nicho_fuente := coalesce(new.nicho_fuente, 'rubro'); end if;
  return new;
end $$;
drop trigger if exists crm_empresas_nicho on public.crm_empresas;
create trigger crm_empresas_nicho before insert or update of rubro, origen, nicho on public.crm_empresas
  for each row execute function public.crm_empresas_nicho();

-- carga inicial: 1) el campo Nicho de los envíos, 2) rubro, 3) base de origen
with dato as (
  select a.empresa_id, public.crm_nicho_regla(public.crm_norm(coalesce(a.datos_extra->>'nicho', (regexp_match(a.datos_extra->>'cabecera', 'Nicho: ([^.\n]+)\.'))[1]))) n
  from public.crm_actividades a where a.tipo = 'mensaje'
), una as (select empresa_id, min(n) n from dato where n is not null group by 1)
update public.crm_empresas e set nicho = una.n, nicho_fuente = 'registro' from una where una.empresa_id = e.id and e.nicho is distinct from una.n;
update public.crm_empresas set rubro = rubro where nicho is null;

-- el nicho de cada participación sale de la empresa si no vino en el registro
update public.crm_tanda_participantes p set nicho = e.nicho from public.crm_empresas e
 where e.id = p.empresa_id and (p.nicho is null or p.nicho <> e.nicho);

-- tandas: la distribución por nicho se calcula en vivo
drop view if exists public.crm_v_tandas;
create view public.crm_v_tandas with (security_invoker = true) as
select t.id, t.clave, t.nombre, t.fecha, t.canal, t.responsable, t.variantes, t.notas,
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

-- la vista de empresas expone el nicho
drop view if exists public.crm_v_empresas cascade;
create view public.crm_v_empresas with (security_invoker = true) as
select
  e.id, e.clave, e.nombre, e.grupo, e.rubro, e.nicho, e.nicho_fuente, e.pais, e.ciudad, e.web, e.origen, e.responsable,
  e.no_contactar, e.error_canal or exists (select 1 from public.crm_contactos k where k.empresa_id = e.id and k.error_canal) as error_canal,
  e.creado_origen, e.importado_en,
  cv.id as conversacion_id, coalesce(cv.etapa, 'sin_contactar') as etapa, cv.atencion, cv.canal,
  coalesce(cv.proximo_paso, t.accion) as proxima_accion, coalesce(cv.proximo_paso_fecha, t.fecha) as proxima_fecha,
  coalesce(cv.responsable, t.responsable, e.responsable) as responsable_accion,
  a.ultimo_saliente, a.saliente_sin_fecha, a.ultima_respuesta, a.respuesta_sin_fecha, a.n_actividades,
  (a.n_actividades = 0 and (coalesce(cv.etapa,'sin_contactar') <> 'sin_contactar' or e.datos_extra->>'contacto_previo' = 'si')) as sin_desglosar,
  (select count(*) from public.crm_contactos k where k.empresa_id = e.id) as n_contactos,
  (select array_agg(distinct coalesce(f.base, f.sistema)) from public.crm_fuentes f where f.empresa_id = e.id) as bases,
  (select count(*) from public.crm_revision r where r.estado = 'abierta' and (r.entidad_clave = e.clave or r.relacionada_clave = e.clave)) as n_revision,
  concat_ws(' ', e.nombre, e.ciudad, e.pais, e.rubro, e.nicho, e.web, e.telefono,
    (select string_agg(concat_ws(' ', k.nombre, k.email, k.telefono), ' ') from public.crm_contactos k where k.empresa_id = e.id)) as busqueda
from public.crm_empresas e
left join lateral (select * from public.crm_conversaciones c where c.empresa_id = e.id order by (c.etapa in ('ganado','perdido')), c.actualizado_en desc limit 1) cv on true
left join lateral (select accion, fecha, responsable from public.crm_tareas x where x.empresa_id = e.id and x.estado = 'pendiente' order by x.fecha nulls last limit 1) t on true
left join lateral (
  select max(fecha_hecho) filter (where public.crm_es_saliente(tipo, direccion)) as ultimo_saliente,
    bool_or(fecha_hecho is null and public.crm_es_saliente(tipo, direccion)) as saliente_sin_fecha,
    max(fecha_hecho) filter (where public.crm_es_respuesta(tipo, direccion)) as ultima_respuesta,
    bool_or(fecha_hecho is null and public.crm_es_respuesta(tipo, direccion)) as respuesta_sin_fecha,
    count(*) as n_actividades
  from public.crm_actividades x where x.empresa_id = e.id) a on true;

-- evaluación por nicho. Tasa con ventana igual para todos: solo envíos con fecha exacta cuya ventana ya terminó.
create or replace function public.crm_nichos(p_ventana_dias int default 3) returns jsonb
language sql stable security invoker set search_path = public as $$
with emp as (select * from public.crm_v_empresas),
env as (
  select a.*, e.nicho from public.crm_actividades a join public.crm_empresas e on e.id = a.empresa_id
  where a.direccion = 'saliente' and a.tipo = 'mensaje'
),
resp as (
  select a.*, e.nicho from public.crm_actividades a join public.crm_empresas e on e.id = a.empresa_id
  where a.direccion = 'entrante' and a.tipo in ('respuesta','derivacion','baja') and a.estado_envio is distinct from 'respuesta_automatica'
),
obs as (
  select e.nicho, e.empresa_id, exists (select 1 from resp r where r.empresa_id = e.empresa_id and r.fecha_hecho >= e.fecha_hecho
    and r.fecha_hecho < e.fecha_hecho + make_interval(days => p_ventana_dias)) as respondio
  from env e where e.fecha_hecho is not null and e.fecha_precision = 'exacta' and e.estado_envio is distinct from 'rebotado'
    and e.fecha_hecho <= now() - make_interval(days => p_ventana_dias)
),
n as (select coalesce(nicho,'Otros') nicho from public.crm_empresas group by 1)
select jsonb_build_object('ventana_dias', p_ventana_dias, 'nichos', coalesce(jsonb_agg(x order by x.contactadas desc, x.empresas desc), '[]')) from (
  select n.nicho,
    (select count(*) from emp where coalesce(emp.nicho,'Otros') = n.nicho) empresas,
    (select count(*) from emp where coalesce(emp.nicho,'Otros') = n.nicho and emp.etapa = 'sin_contactar') sin_contactar,
    (select count(distinct empresa_id) from env where coalesce(env.nicho,'Otros') = n.nicho) contactadas,
    (select count(*) from emp where coalesce(emp.nicho,'Otros') = n.nicho and emp.sin_desglosar) sin_desglosar,
    (select count(*) from env where coalesce(env.nicho,'Otros') = n.nicho) intentos,
    (select count(*) from env where coalesce(env.nicho,'Otros') = n.nicho and env.es_reposicion) reposiciones,
    (select count(*) from env where coalesce(env.nicho,'Otros') = n.nicho and env.estado_envio = 'rebotado') rebotes,
    (select count(distinct empresa_id) from resp where coalesce(resp.nicho,'Otros') = n.nicho) respondieron,
    (select coalesce(jsonb_object_agg(coalesce(c,'sin_clasificar'), k), '{}') from (select clasificacion c, count(*) k from resp where coalesce(resp.nicho,'Otros') = n.nicho group by 1) z) clasificacion,
    (select coalesce(jsonb_object_agg(etapa, k), '{}') from (select etapa, count(*) k from emp where coalesce(emp.nicho,'Otros') = n.nicho group by 1) z) etapas,
    (select count(*) from emp where coalesce(emp.nicho,'Otros') = n.nicho and emp.no_contactar) no_contactar,
    (select count(*) from emp where coalesce(emp.nicho,'Otros') = n.nicho and emp.error_canal) error_canal,
    (select count(*) from obs where coalesce(obs.nicho,'Otros') = n.nicho) observados,
    (select count(*) from obs where coalesce(obs.nicho,'Otros') = n.nicho and obs.respondio) respondieron_en_ventana,
    (select coalesce(jsonb_object_agg(f, k), '{}') from (select nicho_fuente f, count(*) k from public.crm_empresas where coalesce(nicho,'Otros') = n.nicho group by 1) z) fuente_nicho,
    (select coalesce(jsonb_agg(jsonb_build_object('variante', v, 'n', k, 'respondieron', r) order by k desc), '[]') from (
        select coalesce(e.variante,'Sin variante') v, count(*) k,
          count(*) filter (where exists (select 1 from resp r where r.empresa_id = e.empresa_id and r.fecha_hecho >= e.fecha_hecho)) r
        from env e where coalesce(e.nicho,'Otros') = n.nicho group by 1) z) variantes,
    (select min(fecha_hecho) from env where coalesce(env.nicho,'Otros') = n.nicho) primer_envio,
    (select max(fecha_hecho) from env where coalesce(env.nicho,'Otros') = n.nicho) ultimo_envio
  from n
) x
$$;

grant select on public.crm_v_empresas, public.crm_v_tandas to authenticated, service_role;
revoke all on public.crm_v_empresas, public.crm_v_tandas from anon;
revoke execute on function public.crm_nichos(int) from anon;
grant execute on function public.crm_nichos(int) to authenticated, service_role;
