-- CRM GENIDEIA v2 · proyecto fzrrbqqvteyuwbvfgvnx
-- Entidades separadas y vinculadas por una "clave" estable (ID de Airtable, message_id de Gmail, etc.).
-- Las tablas viejas crm_companies / crm_interactions quedan intactas como fuente original.
-- Reglas: nada se borra al importar, los cambios quedan en crm_cambios, lo dudoso va a crm_revision.

create extension if not exists unaccent with schema extensions;

-- ---------- catálogos (texto con check, más fácil de leer y exportar) ----------
-- etapa comercial
--   sin_contactar · contacto_iniciado · conversacion_abierta · exploracion · propuesta_presentada · negociacion · ganado · perdido
-- estado de atención
--   nos_toca_responder · esperando_prospecto · seguimiento_programado · esperando_derivacion · pausado · cerrado

create or replace function public.crm_norm(t text) returns text
language sql immutable parallel safe as $$
  select nullif(regexp_replace(lower(extensions.unaccent(coalesce(t,''))), '[^a-z0-9]+', ' ', 'g'), ' ')
$$;

-- ---------- importaciones (bitácora) ----------
create table if not exists public.crm_importaciones (
  id uuid primary key default gen_random_uuid(),
  archivo text,
  huella text,                              -- sha256 del contenido, para detectar reimportaciones
  modo text not null default 'completar' check (modo in ('completar','actualizar')),
  resumen jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  creado_por text default coalesce(auth.jwt()->>'email', 'api')
);

-- ---------- empresas ----------
create table if not exists public.crm_empresas (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null,
  nombre_norm text,
  grupo text,
  rubro text,
  pais text,
  ciudad text,
  zona_horaria text,
  direccion text,
  web text,
  telefono text,
  whatsapp text,
  redes jsonb not null default '{}'::jsonb,
  origen text,
  responsable text,
  resumen text,
  no_contactar boolean not null default false,
  no_contactar_motivo text,
  no_contactar_fecha timestamptz,
  no_contactar_evidencia text,
  error_canal boolean not null default false,
  error_canal_motivo text,
  error_canal_fecha timestamptz,
  error_canal_evidencia text,
  notas_originales text,
  datos_extra jsonb not null default '{}'::jsonb,
  creado_origen timestamptz,                -- fecha de alta en el sistema de origen (Airtable, CRM viejo)
  importado_en timestamptz,                 -- fecha de importación al CRM
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists crm_empresas_norm_idx on public.crm_empresas(nombre_norm);

-- ---------- contactos ----------
create table if not exists public.crm_contactos (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  empresa_id uuid not null references public.crm_empresas(id) on delete cascade,
  nombre text,
  cargo text,
  rol_decision text check (rol_decision in ('decide','influye','usa','filtra','deriva')),
  email text,
  telefono text,
  whatsapp text,
  canal_preferido text,
  fuentes_verificacion text,
  nivel_verificacion text,
  no_contactar boolean not null default false,
  no_contactar_motivo text,
  no_contactar_fecha timestamptz,
  no_contactar_evidencia text,
  error_canal boolean not null default false,
  error_canal_motivo text,
  error_canal_fecha timestamptz,
  error_canal_evidencia text,
  datos_extra jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists crm_contactos_empresa_idx on public.crm_contactos(empresa_id);
create index if not exists crm_contactos_email_idx on public.crm_contactos(lower(email));

-- ---------- conversaciones / oportunidades ----------
create table if not exists public.crm_conversaciones (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  empresa_id uuid not null references public.crm_empresas(id) on delete cascade,
  canal text,
  objetivo text,
  solucion_interes text,
  etapa text not null default 'contacto_iniciado' check (etapa in ('sin_contactar','contacto_iniciado','conversacion_abierta','exploracion','propuesta_presentada','negociacion','ganado','perdido')),
  atencion text check (atencion in ('nos_toca_responder','esperando_prospecto','seguimiento_programado','esperando_derivacion','pausado','cerrado')),
  proximo_paso text,
  proximo_paso_fecha date,
  responsable text,
  valor numeric,
  moneda text default 'USD',
  motivo_perdida text,
  etapa_evidencia text,                     -- por qué está en esta etapa (texto o enlace)
  datos_extra jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists crm_conv_empresa_idx on public.crm_conversaciones(empresa_id);

create table if not exists public.crm_conversacion_contactos (
  conversacion_id uuid not null references public.crm_conversaciones(id) on delete cascade,
  contacto_id uuid not null references public.crm_contactos(id) on delete cascade,
  primary key (conversacion_id, contacto_id)
);

-- ---------- tandas ----------
create table if not exists public.crm_tandas (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  nombre text not null,
  fecha date,
  canal text,
  responsable text,
  distribucion jsonb not null default '{}'::jsonb,   -- por nicho
  variantes jsonb not null default '[]'::jsonb,
  notas text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ---------- fuentes (registros originales: Airtable, Gmail, CRM viejo, CSV) ----------
create table if not exists public.crm_fuentes (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,               -- p. ej. airtable:recXXXX
  empresa_id uuid references public.crm_empresas(id) on delete cascade,
  sistema text not null,                    -- airtable · gmail · crm_v1 · csv · api
  base text,
  tabla text,
  registro text,
  url text,
  creado_origen timestamptz,
  importado_en timestamptz,
  campos jsonb not null default '{}'::jsonb,
  texto_original text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists crm_fuentes_empresa_idx on public.crm_fuentes(empresa_id);

-- ---------- actividades ----------
create table if not exists public.crm_actividades (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,               -- ID de actividad o message_id (idempotencia)
  empresa_id uuid not null references public.crm_empresas(id) on delete cascade,
  conversacion_id uuid references public.crm_conversaciones(id) on delete set null,
  contacto_id uuid references public.crm_contactos(id) on delete set null,
  tanda_id uuid references public.crm_tandas(id) on delete set null,
  fuente_id uuid references public.crm_fuentes(id) on delete set null,
  responde_a uuid references public.crm_actividades(id) on delete set null,
  tipo text not null check (tipo in ('mensaje','respuesta','llamada','reunion','propuesta','material','seguimiento','derivacion','rebote','baja','nota')),
  direccion text not null check (direccion in ('saliente','entrante','interna')),
  canal text,
  fecha_hecho timestamptz,                  -- cuándo ocurrió (null = sin verificar)
  fecha_precision text not null default 'exacta' check (fecha_precision in ('exacta','dia','sin_verificar')),
  fecha_reporte timestamptz,                -- cuándo se registró en el sistema de origen
  importado_en timestamptz,                 -- cuándo entró a este CRM
  asunto text,
  texto text,                               -- texto o resumen fiel
  es_resumen boolean not null default false,
  estado_envio text check (estado_envio in ('envio_confirmado','sin_error_al_corte','demora_temporal','rebotado','respuesta_automatica','respuesta_humana')),
  clasificacion text check (clasificacion in ('interes_concreto','cordial_sin_compromiso','negativa_baja','derivacion')),
  primera_respuesta boolean,
  variante text,
  intento int,
  es_reposicion boolean not null default false,
  reemplaza text,                           -- clave o dato del envío reemplazado
  message_id text,
  evidencia text,                           -- enlace o referencia verificable
  responsable text,
  legacy_ids text[] not null default '{}',
  datos_extra jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists crm_act_empresa_idx on public.crm_actividades(empresa_id, fecha_hecho desc);
create index if not exists crm_act_conv_idx on public.crm_actividades(conversacion_id);
create index if not exists crm_act_tanda_idx on public.crm_actividades(tanda_id);
create unique index if not exists crm_act_msgid_idx on public.crm_actividades(message_id) where message_id is not null;

-- ---------- propuestas y materiales ----------
create table if not exists public.crm_materiales (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  empresa_id uuid not null references public.crm_empresas(id) on delete cascade,
  conversacion_id uuid references public.crm_conversaciones(id) on delete set null,
  contacto_id uuid references public.crm_contactos(id) on delete set null,   -- destinatario
  actividad_id uuid references public.crm_actividades(id) on delete set null, -- envío
  tipo text not null check (tipo in ('ejemplo_referencia','propuesta_comercial','presupuesto')),
  titulo text not null,
  version text,
  url text,
  enviado_en timestamptz,
  respuesta_actividad_id uuid references public.crm_actividades(id) on delete set null,
  respuesta_resumen text,
  datos_extra jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists crm_mat_empresa_idx on public.crm_materiales(empresa_id);

-- ---------- tareas y seguimientos (no envían nada solas) ----------
create table if not exists public.crm_tareas (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  empresa_id uuid not null references public.crm_empresas(id) on delete cascade,
  conversacion_id uuid references public.crm_conversaciones(id) on delete set null,
  accion text not null,
  fecha date,
  responsable text,
  estado text not null default 'pendiente' check (estado in ('pendiente','hecha','cancelada')),
  hecha_en timestamptz,
  origen text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists crm_tareas_fecha_idx on public.crm_tareas(estado, fecha);

-- ---------- participación en tandas (contactos únicos vs intentos vs reposiciones) ----------
create table if not exists public.crm_tanda_participantes (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  tanda_id uuid not null references public.crm_tandas(id) on delete cascade,
  empresa_id uuid not null references public.crm_empresas(id) on delete cascade,
  contacto_id uuid references public.crm_contactos(id) on delete set null,
  actividad_id uuid references public.crm_actividades(id) on delete set null,
  nicho text,
  variante text,
  intento int not null default 1,
  es_reposicion boolean not null default false,
  reemplaza text,
  resultado text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ---------- espacio administrativo (no cuenta como prospección) ----------
create table if not exists public.crm_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  tipo text not null check (tipo in ('importacion','conciliacion','error','tarea','envio_lote','otro')),
  titulo text,
  fecha timestamptz,
  detalle text,
  texto_original text,
  fuente_url text,
  legacy_ids text[] not null default '{}',
  datos_extra jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ---------- revisión humana ----------
create table if not exists public.crm_revision (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  tipo text not null check (tipo in ('posible_duplicado','conflicto','incompleto','sin_desglosar','fecha_sin_verificar','sin_empresa','verificar_dato')),
  entidad text not null,
  entidad_clave text,
  relacionada_clave text,
  detalle text not null,
  datos jsonb not null default '{}'::jsonb,
  estado text not null default 'abierta' check (estado in ('abierta','resuelta','descartada')),
  resolucion text,
  resuelto_por text,
  resuelto_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists crm_revision_estado_idx on public.crm_revision(estado, tipo);

-- ---------- historial de cambios ----------
create table if not exists public.crm_cambios (
  id bigint generated always as identity primary key,
  tabla text not null,
  clave text not null,
  campo text not null,
  antes jsonb,
  despues jsonb,
  importacion_id uuid references public.crm_importaciones(id) on delete set null,
  hecho_por text default coalesce(auth.jwt()->>'email', 'api'),
  hecho_en timestamptz not null default now()
);
create index if not exists crm_cambios_clave_idx on public.crm_cambios(tabla, clave);

-- ---------- claves de API para asistentes (solo se guarda el hash) ----------
create table if not exists public.crm_api_keys (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  hash text not null unique,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  ultimo_uso timestamptz
);

-- ---------- actualizado_en automático ----------
create or replace function public.crm_touch() returns trigger language plpgsql as $$
begin new.actualizado_en := now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['crm_empresas','crm_contactos','crm_conversaciones','crm_tandas','crm_fuentes','crm_actividades','crm_materiales','crm_tareas','crm_tanda_participantes','crm_ejecuciones','crm_revision'] loop
    execute format('drop trigger if exists %I on public.%I', t||'_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.crm_touch()', t||'_touch', t);
  end loop;
end $$;

-- ---------- seguridad: solo administradores del CRM ----------
do $$ declare t text; begin
  foreach t in array array['crm_importaciones','crm_empresas','crm_contactos','crm_conversaciones','crm_conversacion_contactos','crm_tandas','crm_fuentes','crm_actividades','crm_materiales','crm_tareas','crm_tanda_participantes','crm_ejecuciones','crm_revision','crm_cambios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin())', t||'_admin', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
-- las claves de API no son visibles desde el navegador
alter table public.crm_api_keys enable row level security;
revoke all on public.crm_api_keys from anon, authenticated;
grant usage, select on all sequences in schema public to authenticated;
