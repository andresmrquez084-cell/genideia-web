-- CRM GENIDEIA · prospección multicanal (27/11/2026)
-- Suma embudo de 10 etapas, canal de origen, usuario de Instagram, reuniones y freno de asesor.
-- Solo agrega: no borra datos, no cambia `etapa` histórica ni las vistas existentes (las usan las automatizaciones).
-- Reversión: drop de las columnas, la tabla crm_reuniones, las vistas crm_v_oportunidades/crm_v_act_embudo y los triggers nuevos.

-- ---------- canal normalizado (solo para leer; los datos guardados no se tocan) ----------
create or replace function public.crm_canal(t text) returns text
language sql immutable parallel safe as $$
  select case lower(coalesce(trim(t), ''))
    when 'email' then 'Email' when 'correo' then 'Email' when 'mail' then 'Email'
    when 'whatsapp' then 'WhatsApp' when 'wpp' then 'WhatsApp'
    when 'instagram' then 'Instagram' when 'ig' then 'Instagram'
    when 'llamada' then 'Llamada' when 'telefono' then 'Llamada'
    when '' then 'Sin dato' when 'por verificar' then 'Sin dato'
    else 'Otro' end
$$;

-- usuario de Instagram normalizado: "@Foo", "instagram.com/foo/" → "foo"
create or replace function public.crm_ig_norm(t text) returns text
language sql immutable parallel safe as $$
  select nullif(lower(split_part(split_part(split_part(ltrim(regexp_replace(trim(coalesce(t,'')), '^.*instagram\.com/', '', 'i'), '@'), '/', 1), '?', 1), ' ', 1)), '')
$$;

-- ---------- empresas: canal de origen, Instagram y tipo de relación ----------
alter table public.crm_empresas
  add column if not exists canal_origen text,
  add column if not exists instagram_usuario text,
  add column if not exists ig_relacion text;
alter table public.crm_empresas drop constraint if exists crm_empresas_ig_relacion_check;
alter table public.crm_empresas add constraint crm_empresas_ig_relacion_check check (ig_relacion in ('seguidor','negocio_investigado','otro'));
create index if not exists crm_empresas_ig_idx on public.crm_empresas(instagram_usuario);

-- el usuario de Instagram sale de redes.instagram si no se cargó a mano
create or replace function public.crm_empresas_ig() returns trigger language plpgsql as $$
begin
  if new.instagram_usuario is null and new.redes ? 'instagram' then
    new.instagram_usuario := public.crm_ig_norm(new.redes->>'instagram');
  elsif new.instagram_usuario is not null then
    new.instagram_usuario := public.crm_ig_norm(new.instagram_usuario);
  end if;
  return new;
end $$;
drop trigger if exists crm_empresas_ig on public.crm_empresas;
create trigger crm_empresas_ig before insert or update of redes, instagram_usuario on public.crm_empresas
  for each row execute function public.crm_empresas_ig();

-- ---------- conversaciones: embudo ampliado y canal de origen ----------
-- etapas del embudo (orden):
--   prospecto · primer_mensaje · respuesta · material · conversacion_comercial · reunion_agendada
--   reunion_realizada · propuesta · negociacion · ganado · perdido
alter table public.crm_conversaciones
  add column if not exists embudo text,
  add column if not exists embudo_en timestamptz,
  add column if not exists canal_origen text;
alter table public.crm_conversaciones drop constraint if exists crm_conversaciones_embudo_check;
alter table public.crm_conversaciones add constraint crm_conversaciones_embudo_check check (embudo in
  ('prospecto','primer_mensaje','respuesta','material','conversacion_comercial','reunion_agendada','reunion_realizada','propuesta','negociacion','ganado','perdido'));

create or replace function public.crm_embudo_rank(e text) returns int language sql immutable as $$
  select array_position(array['prospecto','primer_mensaje','respuesta','material','conversacion_comercial','reunion_agendada',
    'reunion_realizada','propuesta','negociacion','ganado','perdido'], e)
$$;
create or replace function public.crm_etapa_a_embudo(e text) returns text language sql immutable as $$
  select case e when 'sin_contactar' then 'prospecto' when 'contacto_iniciado' then 'primer_mensaje'
    when 'conversacion_abierta' then 'respuesta' when 'exploracion' then 'conversacion_comercial'
    when 'propuesta_presentada' then 'propuesta' when 'negociacion' then 'negociacion'
    when 'ganado' then 'ganado' when 'perdido' then 'perdido' end
$$;
create or replace function public.crm_embudo_a_etapa(e text) returns text language sql immutable as $$
  select case e when 'prospecto' then 'sin_contactar' when 'primer_mensaje' then 'contacto_iniciado'
    when 'respuesta' then 'conversacion_abierta' when 'material' then 'conversacion_abierta'
    when 'conversacion_comercial' then 'exploracion' when 'reunion_agendada' then 'exploracion' when 'reunion_realizada' then 'exploracion'
    when 'propuesta' then 'propuesta_presentada' when 'negociacion' then 'negociacion'
    when 'ganado' then 'ganado' when 'perdido' then 'perdido' end
$$;

-- `etapa` y `embudo` quedan sincronizadas:
--  · si se cambia `embudo` (CRM nuevo), `etapa` toma su equivalente (lo que leen las vistas y métricas viejas)
--  · si se cambia solo `etapa` (automatizaciones, importador), `embudo` avanza a su equivalente sin retroceder
create or replace function public.crm_conv_embudo_sync() returns trigger language plpgsql as $$
declare eq text;
begin
  if tg_op = 'INSERT' then
    if new.embudo is null then new.embudo := public.crm_etapa_a_embudo(new.etapa);
    else new.etapa := public.crm_embudo_a_etapa(new.embudo); end if;
    new.embudo_en := now();
    if new.canal_origen is null then new.canal_origen := nullif(public.crm_canal(new.canal), 'Sin dato'); end if;
    return new;
  end if;
  if new.embudo is distinct from old.embudo then
    new.etapa := public.crm_embudo_a_etapa(new.embudo);
    new.embudo_en := now();
  elsif new.etapa is distinct from old.etapa then
    eq := public.crm_etapa_a_embudo(new.etapa);
    if new.etapa in ('ganado','perdido') or old.embudo is null
       or public.crm_embudo_rank(eq) > public.crm_embudo_rank(old.embudo) or old.embudo in ('ganado','perdido') then
      new.embudo := eq; new.embudo_en := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists crm_conv_embudo_sync on public.crm_conversaciones;
create trigger crm_conv_embudo_sync before insert or update on public.crm_conversaciones
  for each row execute function public.crm_conv_embudo_sync();

-- ---------- respuestas: dos clasificaciones más ----------
-- interes_concreto = positiva · cordial_sin_compromiso · solicita_info · derivacion · negativa_baja = negativa · sin_interes_definido
alter table public.crm_actividades drop constraint if exists crm_actividades_clasificacion_check;
alter table public.crm_actividades add constraint crm_actividades_clasificacion_check check (clasificacion in
  ('interes_concreto','cordial_sin_compromiso','solicita_info','derivacion','negativa_baja','sin_interes_definido'));

-- ---------- reuniones ----------
create table if not exists public.crm_reuniones (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  empresa_id uuid not null references public.crm_empresas(id) on delete cascade,
  conversacion_id uuid references public.crm_conversaciones(id) on delete set null,
  actividad_id uuid references public.crm_actividades(id) on delete set null,
  asesor text,
  canal_origen text,
  inicio timestamptz,
  zona_horaria text default 'America/Montevideo',
  participantes text,
  enlace text,
  estado text not null default 'agendada' check (estado in ('agendada','realizada','no_asistio','reprogramada','cancelada')),
  resultado text,
  proxima_accion text,
  proxima_fecha date,
  reprograma_a uuid references public.crm_reuniones(id) on delete set null,
  notas text,
  creado_por text default coalesce(auth.jwt()->>'email', 'api'),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists crm_reuniones_empresa_idx on public.crm_reuniones(empresa_id);
create index if not exists crm_reuniones_inicio_idx on public.crm_reuniones(estado, inicio);
drop trigger if exists crm_reuniones_touch on public.crm_reuniones;
create trigger crm_reuniones_touch before update on public.crm_reuniones for each row execute function public.crm_touch();
alter table public.crm_reuniones enable row level security;
drop policy if exists crm_reuniones_admin on public.crm_reuniones;
create policy crm_reuniones_admin on public.crm_reuniones for all to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());
revoke all on public.crm_reuniones from anon;
grant select, insert, update, delete on public.crm_reuniones to authenticated, service_role;

-- una reunión mueve el embudo hacia adelante (nunca lo hace retroceder ni la marca realizada sola)
create or replace function public.crm_reunion_embudo() returns trigger language plpgsql as $$
declare c public.crm_conversaciones; v_meta text;
begin
  if new.asesor is null then select asesor into new.asesor from public.crm_empresas where id = new.empresa_id; end if;
  if new.canal_origen is null then select canal_origen into new.canal_origen from public.crm_empresas where id = new.empresa_id; end if;
  if new.conversacion_id is null then
    select * into c from public.crm_conversaciones where empresa_id = new.empresa_id
      order by (etapa in ('ganado','perdido')), actualizado_en desc limit 1;
    new.conversacion_id := c.id;
  else
    select * into c from public.crm_conversaciones where id = new.conversacion_id;
  end if;
  v_meta := case new.estado when 'agendada' then 'reunion_agendada' when 'reprogramada' then 'reunion_agendada'
                              when 'realizada' then 'reunion_realizada' end;
  if c.id is not null and v_meta is not null and c.embudo not in ('ganado','perdido')
     and coalesce(public.crm_embudo_rank(c.embudo), 0) < public.crm_embudo_rank(v_meta) then
    update public.crm_conversaciones set embudo = v_meta where id = c.id;
  end if;
  return new;
end $$;
drop trigger if exists crm_reunion_embudo on public.crm_reuniones;
create trigger crm_reunion_embudo before insert or update of estado on public.crm_reuniones
  for each row execute function public.crm_reunion_embudo();

-- ---------- freno: una empresa no puede estar con dos asesores ----------
-- Coincidencia por nombre (mismo país o país vacío), dominio web, teléfono, email de contacto o usuario de Instagram.
-- Desde el CRM (usuario conectado) bloquea con un mensaje. Desde la API/automatizaciones no corta la carga:
-- deja la asignación anterior y abre un caso en Revisión.
create or replace function public.crm_asesor_conflicto(p_id uuid, p_asesor text, p_nombre_norm text, p_pais text, p_web text, p_tel text, p_ig text)
returns text language sql stable as $$
  select o.nombre || ' (' || o.asesor || ')'
  from public.crm_empresas o
  where o.id is distinct from p_id and o.asesor is not null and o.asesor <> p_asesor and (
       (p_nombre_norm is not null and length(p_nombre_norm) >= 5 and o.nombre_norm = p_nombre_norm and (p_pais is null or o.pais is null or o.pais = p_pais))
    or (p_web is not null and o.web_dominio = p_web)
    or (p_tel is not null and o.tel_digitos = p_tel)
    or (p_ig is not null and o.instagram_usuario = p_ig)
    or exists (select 1 from public.crm_contactos k join public.crm_contactos ko on lower(ko.email) = lower(k.email)
               where k.empresa_id = p_id and ko.empresa_id = o.id and coalesce(k.email, '') <> ''))
  limit 1
$$;

-- se llama crm_zz_… para correr después de los triggers que calculan nombre, dominio, teléfono e Instagram
create or replace function public.crm_asesor_freno() returns trigger language plpgsql as $$
declare choque text;
begin
  if new.asesor is null then return new; end if;
  if tg_op = 'UPDATE' and new.asesor is not distinct from old.asesor then return new; end if;
  choque := public.crm_asesor_conflicto(new.id, new.asesor, new.nombre_norm, new.pais, new.web_dominio, new.tel_digitos, new.instagram_usuario);
  if choque is null then return new; end if;
  if coalesce(auth.role(), '') = 'authenticated' then
    raise exception 'No se puede asignar a %: coincide con %. Una empresa no puede prospectarse por dos asesores.', new.asesor, choque;
  end if;
  insert into public.crm_revision (clave, tipo, entidad, entidad_clave, detalle, datos)
  values ('asesor:' || new.clave || ':' || new.asesor, 'posible_duplicado', 'empresas', new.clave,
          'Asignación a ' || new.asesor || ' frenada: coincide con ' || choque, jsonb_build_object('asesor_pedido', new.asesor))
  on conflict (clave) do nothing;
  new.asesor := case when tg_op = 'UPDATE' then old.asesor end;
  return new;
end $$;
drop trigger if exists crm_asesor_freno on public.crm_empresas;
drop trigger if exists crm_zz_asesor_freno on public.crm_empresas;
create trigger crm_zz_asesor_freno before insert or update on public.crm_empresas
  for each row execute function public.crm_asesor_freno();

-- ---------- vistas nuevas (las existentes no se tocan) ----------
-- una fila por oportunidad, con todo lo que necesita la pestaña Instagram y el panel comercial
create or replace view public.crm_v_oportunidades with (security_invoker = true) as
select
  c.id, c.clave, c.empresa_id, e.clave as empresa_clave, e.nombre as empresa, e.pais, coalesce(e.nicho, e.rubro) as nicho,
  e.instagram_usuario, e.ig_relacion, e.web, e.telefono,
  coalesce(e.asesor, c.responsable, e.responsable) as asesor, e.asesor as asesor_empresa,
  public.crm_canal(c.canal) as canal,
  coalesce(c.canal_origen, e.canal_origen, nullif(public.crm_canal(c.canal), 'Sin dato')) as canal_origen,
  c.etapa, coalesce(c.embudo, public.crm_etapa_a_embudo(c.etapa)) as embudo, c.embudo_en, c.atencion,
  c.proximo_paso, c.proximo_paso_fecha, c.valor, c.moneda, c.motivo_perdida, c.actualizado_en,
  a.primer_mensaje, a.primer_mensaje_sin_fecha, a.mensaje_texto, a.variante, a.ultima_respuesta, a.ultima_respuesta_texto, a.ultima_clasificacion,
  a.n_materiales, a.n_actividades,
  (select count(*) from public.crm_reuniones r where r.conversacion_id = c.id and r.estado in ('agendada','reprogramada') and (r.inicio is null or r.inicio >= now() - interval '1 day')) as reuniones_pendientes,
  e.no_contactar
from public.crm_conversaciones c
join public.crm_empresas e on e.id = c.empresa_id
left join lateral (
  select
    min(x.fecha_hecho) filter (where x.direccion = 'saliente' and x.tipo = 'mensaje') as primer_mensaje,
    bool_or(x.fecha_hecho is null and x.direccion = 'saliente' and x.tipo = 'mensaje') as primer_mensaje_sin_fecha,
    (array_agg(left(x.texto, 600) order by x.fecha_hecho nulls last) filter (where x.direccion = 'saliente' and x.tipo = 'mensaje'))[1] as mensaje_texto,
    (array_agg(x.variante order by x.fecha_hecho nulls last) filter (where x.direccion = 'saliente' and x.tipo = 'mensaje' and x.variante is not null))[1] as variante,
    max(x.fecha_hecho) filter (where x.direccion = 'entrante' and x.tipo in ('respuesta','derivacion','baja')) as ultima_respuesta,
    (array_agg(left(coalesce(x.texto, x.asunto), 300) order by x.fecha_hecho desc nulls last) filter (where x.direccion = 'entrante' and x.tipo in ('respuesta','derivacion','baja')))[1] as ultima_respuesta_texto,
    (array_agg(x.clasificacion order by x.fecha_hecho desc nulls last) filter (where x.direccion = 'entrante' and x.clasificacion is not null))[1] as ultima_clasificacion,
    count(*) filter (where x.direccion = 'saliente' and x.tipo = 'material') as n_materiales,
    count(*) as n_actividades
  from public.crm_actividades x where x.empresa_id = c.empresa_id and (x.conversacion_id = c.id or x.conversacion_id is null)
) a on true;

-- actividades listas para medir: asesor y canal resueltos, sin tocar los datos
-- asesor: el de la actividad, si no el de la empresa, si no el responsable de la tanda
create or replace view public.crm_v_act_embudo with (security_invoker = true) as
select
  x.id, x.empresa_id, x.conversacion_id, x.tanda_id, x.tipo, x.direccion, x.clasificacion, x.estado_envio,
  x.fecha_hecho, x.fecha_precision, x.fecha_reporte, x.variante, x.primera_respuesta,
  public.crm_canal(x.canal) as canal,
  coalesce(c.canal_origen, e.canal_origen, nullif(public.crm_canal(c.canal), 'Sin dato'), nullif(public.crm_canal(x.canal), 'Sin dato')) as canal_origen,
  coalesce(x.asesor, e.asesor, t.responsable, x.responsable) as asesor,
  e.pais, coalesce(e.nicho, e.rubro) as nicho
from public.crm_actividades x
join public.crm_empresas e on e.id = x.empresa_id
left join public.crm_conversaciones c on c.id = x.conversacion_id
left join public.crm_tandas t on t.id = x.tanda_id;

create or replace view public.crm_v_reuniones with (security_invoker = true) as
select r.*, e.nombre as empresa, e.clave as empresa_clave, e.pais, coalesce(e.nicho, e.rubro) as nicho
from public.crm_reuniones r join public.crm_empresas e on e.id = r.empresa_id;

revoke all on public.crm_v_oportunidades, public.crm_v_act_embudo, public.crm_v_reuniones from anon;
grant select on public.crm_v_oportunidades, public.crm_v_act_embudo, public.crm_v_reuniones to authenticated, service_role;

-- ---------- completar datos derivados (sin pisar nada cargado) ----------
-- sin tocar actualizado_en: las vistas ordenan por esa fecha
alter table public.crm_empresas disable trigger crm_empresas_touch;
alter table public.crm_conversaciones disable trigger crm_conversaciones_touch;
update public.crm_empresas set instagram_usuario = public.crm_ig_norm(redes->>'instagram')
  where instagram_usuario is null and redes ? 'instagram';

update public.crm_conversaciones set canal_origen = nullif(public.crm_canal(canal), 'Sin dato')
  where canal_origen is null and public.crm_canal(canal) not in ('Sin dato','Otro');

-- canal de origen de la empresa: el de su primera conversación con canal conocido
update public.crm_empresas e set canal_origen = x.canal_origen
from (select distinct on (empresa_id) empresa_id, canal_origen from public.crm_conversaciones
      where canal_origen is not null order by empresa_id, creado_en) x
where x.empresa_id = e.id and e.canal_origen is null;
-- Pato Amarilla: la conversación quedó con canal "Reunión", pero salió de Instagram (perfil y DM del 24/11)
update public.crm_empresas set canal_origen = 'Instagram' where canal_origen is null and instagram_usuario is not null
  and exists (select 1 from public.crm_actividades a where a.empresa_id = crm_empresas.id and a.canal = 'Instagram');

-- embudo inicial: equivalente de la etapa, adelantado solo con evidencia registrada
update public.crm_conversaciones c set embudo = x.e from (
  select c2.id,
    case
      when c2.etapa in ('ganado','perdido','negociacion','propuesta_presentada') then public.crm_etapa_a_embudo(c2.etapa)
      when exists (select 1 from public.crm_actividades a where a.empresa_id = c2.empresa_id and a.tipo = 'reunion') then
        case when c2.etapa = 'exploracion' then 'reunion_realizada' else public.crm_etapa_a_embudo(c2.etapa) end
      when c2.etapa in ('conversacion_abierta','exploracion') and exists (select 1 from public.crm_actividades a
             where a.empresa_id = c2.empresa_id and a.direccion = 'saliente' and a.tipo = 'material') and c2.etapa = 'conversacion_abierta' then 'material'
      else public.crm_etapa_a_embudo(c2.etapa) end as e
  from public.crm_conversaciones c2 where c2.embudo is null
) x where x.id = c.id;

alter table public.crm_empresas enable trigger crm_empresas_touch;
alter table public.crm_conversaciones enable trigger crm_conversaciones_touch;

-- ---------- reuniones ya registradas como actividad ----------
-- Pato Amarilla: reunión exploratoria hecha el 25/11 (salió de Instagram).
insert into public.crm_reuniones (clave, empresa_id, actividad_id, inicio, zona_horaria, estado, resultado, notas)
select 'reunion:' || a.clave, a.empresa_id, a.id, a.fecha_hecho, 'America/Montevideo', 'realizada',
       left(a.texto, 500), 'Cargada desde la actividad registrada el 25/11/2026.'
from public.crm_actividades a join public.crm_empresas e on e.id = a.empresa_id
where e.nombre = 'Pato Amarilla' and a.tipo = 'reunion'
on conflict (clave) do nothing;
-- Grupo Café Plaza: confirmada para el jueves 26/11/2026 15:30 Puebla (18:30 Montevideo). Queda agendada
-- hasta que se registre el resultado: no se marca realizada solo porque pasó el horario.
insert into public.crm_reuniones (clave, empresa_id, actividad_id, inicio, zona_horaria, enlace, estado, notas)
select 'reunion:' || a.clave, a.empresa_id, a.id, timestamptz '2026-11-26 15:30:00 America/Mexico_City', 'America/Mexico_City',
       'https://meet.google.com/wpj-gbij-myc', 'agendada', 'Cargada desde la actividad registrada el 25/11/2026. Falta registrar el resultado.'
from public.crm_actividades a join public.crm_empresas e on e.id = a.empresa_id
where e.nombre = 'Grupo Café Plaza' and a.tipo = 'reunion'
on conflict (clave) do nothing;
