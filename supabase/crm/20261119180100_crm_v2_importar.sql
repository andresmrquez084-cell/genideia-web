-- CRM GENIDEIA v2 · importación en bloque idempotente.
-- crm_importar(payload, aplicar, modo, archivo)
--   aplicar=false → vista previa: corre todo y lo deshace, devuelve el informe.
--   modo 'completar' (por defecto): solo llena campos vacíos; si un dato cambia, queda como conflicto para revisión.
--   modo 'actualizar': pisa el dato y guarda el valor anterior en crm_cambios.
-- Todo se identifica por "clave". Repetir el mismo archivo no duplica nada.

alter table public.crm_empresas add column if not exists web_dominio text, add column if not exists tel_digitos text;
create index if not exists crm_empresas_web_idx on public.crm_empresas(web_dominio);
create index if not exists crm_empresas_tel_idx on public.crm_empresas(tel_digitos);
create or replace function public.crm_empresas_norm() returns trigger language plpgsql as $$
begin
  new.nombre_norm := public.crm_norm(new.nombre);
  new.web_dominio := case when new.web is null or new.web ~* '(instagram|facebook|google|linktr|wa\.me|whatsapp|mercadolibre|wix|business\.site)\.' then null
    else nullif(lower(regexp_replace(regexp_replace(new.web,'^https?://(www\.)?',''),'[/?#].*$','')), '') end;
  new.tel_digitos := case when length(regexp_replace(coalesce(new.telefono,''),'\D','','g')) >= 8 then right(regexp_replace(new.telefono,'\D','','g'), 8) end;
  return new;
end $$;
drop trigger if exists crm_empresas_norm on public.crm_empresas;
create trigger crm_empresas_norm before insert or update of nombre, web, telefono on public.crm_empresas
  for each row execute function public.crm_empresas_norm();
update public.crm_empresas set nombre = nombre;

-- Columnas que el importador puede escribir en cada tabla.
create or replace function public.crm__cols(p_tabla text) returns text[]
language sql stable as $$
  select coalesce(array_agg(attname::text order by attnum), '{}')
  from pg_attribute
  where attrelid = ('public.'||p_tabla)::regclass and attnum > 0 and not attisdropped
    and attname not in ('id','creado_en','actualizado_en','nombre_norm','web_dominio','tel_digitos')
$$;

-- Inserta o completa una fila por clave. Devuelve {r: alta|actualizada|igual, conflictos: [...]}.
create or replace function public.crm__upsert(p_tabla text, p_fila jsonb, p_modo text, p_imp uuid)
returns jsonb language plpgsql as $$
declare
  cols text[] := public.crm__cols(p_tabla);
  nueva jsonb := '{}'::jsonb;
  tipada jsonb;
  vieja jsonb;
  cambios jsonb := '{}'::jsonb;
  conflictos jsonb := '[]'::jsonb;
  k text; v jsonb; o jsonb; lista text;
  append_cols text[] := array['notas_originales','texto_original'];
  merge_cols text[] := array['datos_extra','campos','redes','distribucion'];
begin
  -- solo columnas conocidas y sin vacíos
  for k, v in select * from jsonb_each(p_fila) loop
    if k = any(cols) and v is not null and v <> 'null'::jsonb and v <> '""'::jsonb and v <> '{}'::jsonb and v <> '[]'::jsonb then
      nueva := nueva || jsonb_build_object(k, v);
    end if;
  end loop;
  if coalesce(nueva->>'clave','') = '' then raise exception 'Falta la clave'; end if;

  execute format('select to_jsonb(t) from public.%I t where clave = $1', p_tabla) into vieja using nueva->>'clave';

  if vieja is null then
    select string_agg(quote_ident(x), ',') into lista from jsonb_object_keys(nueva) x;
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1)', p_tabla, lista, lista, p_tabla) using nueva;
    return jsonb_build_object('r','alta');
  end if;

  -- valores con el tipo de la columna (para comparar fechas, números, etc. sin falsos cambios)
  execute format('select to_jsonb(jsonb_populate_record(null::public.%I, $1))', p_tabla) into tipada using nueva;

  for k in select jsonb_object_keys(nueva) loop
    continue when k = 'clave';
    v := tipada->k; o := vieja->k;
    if o = 'null'::jsonb or o = '""'::jsonb or o = '[]'::jsonb then o := null; end if;
    if o is not distinct from v then continue; end if;
    if k = any(append_cols) then
      if o is null or o = '""'::jsonb then cambios := cambios || jsonb_build_object(k, v);
      elsif position(v#>>'{}' in o#>>'{}') = 0 then
        cambios := cambios || jsonb_build_object(k, to_jsonb((o#>>'{}') || E'\n\n— Agregado en importación ' || to_char(now(),'YYYY-MM-DD') || E' —\n' || (v#>>'{}')));
      end if;
    elsif k = any(merge_cols) then
      if p_modo = 'actualizar' then cambios := cambios || jsonb_build_object(k, coalesce(o,'{}'::jsonb) || v);
      else cambios := cambios || jsonb_build_object(k, v || coalesce(o,'{}'::jsonb)); end if;
      if cambios->k = o then cambios := cambios - k; end if;
    elsif jsonb_typeof(v) = 'array' then
      select to_jsonb(array(select distinct x from (select jsonb_array_elements_text(coalesce(o,'[]'::jsonb)) x union select jsonb_array_elements_text(v)) s order by 1)) into v;
      if v is distinct from o then cambios := cambios || jsonb_build_object(k, v); end if;
    elsif jsonb_typeof(v) = 'boolean' then
      -- una marca de "no contactar" o "error de canal" nunca se apaga sola
      if v = 'true'::jsonb and coalesce(o,'false'::jsonb) = 'false'::jsonb then cambios := cambios || jsonb_build_object(k, v);
      elsif p_modo = 'actualizar' then cambios := cambios || jsonb_build_object(k, v); end if;
    elsif o is null or o = '""'::jsonb then
      cambios := cambios || jsonb_build_object(k, v);
    elsif p_modo = 'actualizar' then
      cambios := cambios || jsonb_build_object(k, v);
    else
      conflictos := conflictos || jsonb_build_object('campo', k, 'actual', o, 'importado', v);
    end if;
  end loop;

  if cambios = '{}'::jsonb then
    return jsonb_build_object('r', 'igual', 'conflictos', conflictos);
  end if;

  select string_agg(quote_ident(x), ',') into lista from jsonb_object_keys(cambios) x;
  execute format('update public.%I set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where clave = $2',
    p_tabla, lista, lista, p_tabla) using cambios, nueva->>'clave';
  insert into public.crm_cambios (tabla, clave, campo, antes, despues, importacion_id)
    select p_tabla, nueva->>'clave', x, vieja->x, cambios->x, p_imp from jsonb_object_keys(cambios) x;
  return jsonb_build_object('r', 'actualizada', 'conflictos', conflictos);
end $$;

create or replace function public.crm__id(p_tabla text, p_clave text) returns uuid
language plpgsql stable as $$
declare r uuid;
begin
  if p_clave is null or p_clave = '' then return null; end if;
  execute format('select id from public.%I where clave = $1', p_tabla) into r using p_clave;
  return r;
end $$;

create or replace function public.crm_importar(p jsonb, p_aplicar boolean default false, p_modo text default 'completar', p_archivo text default null)
returns jsonb language plpgsql security invoker set search_path = public, extensions as $$
declare
  -- entidad del payload → tabla, en orden de dependencias
  orden text[][] := array[
    ['empresas','crm_empresas'], ['tandas','crm_tandas'], ['fuentes','crm_fuentes'], ['contactos','crm_contactos'],
    ['conversaciones','crm_conversaciones'], ['actividades','crm_actividades'], ['materiales','crm_materiales'],
    ['tareas','crm_tareas'], ['participaciones','crm_tanda_participantes'], ['ejecuciones','crm_ejecuciones'], ['revision','crm_revision']];
  -- referencia en el payload → columna y tabla destino
  refs text[][] := array[
    ['empresa','empresa_id','crm_empresas'], ['contacto','contacto_id','crm_contactos'], ['conversacion','conversacion_id','crm_conversaciones'],
    ['tanda','tanda_id','crm_tandas'], ['fuente','fuente_id','crm_fuentes'], ['actividad','actividad_id','crm_actividades'],
    ['respuesta_actividad','respuesta_actividad_id','crm_actividades']];
  rep jsonb := jsonb_build_object('aplicado', p_aplicar, 'modo', p_modo, 'entidades', '{}'::jsonb);
  confl jsonb := '[]'::jsonb; fall jsonb := '[]'::jsonb; omit jsonb := '[]'::jsonb; coinc jsonb := '[]'::jsonb;
  v_huella text := encode(extensions.digest(p::text, 'sha256'), 'hex');
  previa record;
  imp uuid := gen_random_uuid();
  i int; j int; ent text; tabla text; fila jsonb; res jsonb; rid uuid; cnt jsonb; c jsonb;
  nuevas_empresas text[] := '{}';
begin
  if not (public.crm_is_admin() or coalesce(auth.role(),'') = 'service_role') then
    raise exception 'Solo administradores del CRM';
  end if;
  if p_modo not in ('completar','actualizar') then raise exception 'Modo inválido'; end if;
  if jsonb_typeof(p) <> 'object' then raise exception 'El archivo no tiene el formato esperado'; end if;

  select id, creado_en into previa from public.crm_importaciones where crm_importaciones.huella = v_huella order by creado_en limit 1;
  if previa.id is not null then rep := rep || jsonb_build_object('repetida_de', previa.creado_en); end if;
  rep := rep || jsonb_build_object('huella', v_huella);

  begin
    insert into public.crm_importaciones (id, archivo, huella, modo) values (imp, p_archivo, v_huella, p_modo);

    for i in 1 .. array_length(orden, 1) loop
      ent := orden[i][1]; tabla := orden[i][2];
      cnt := jsonb_build_object('altas',0,'actualizaciones',0,'sin_cambios',0,'conflictos',0,'fallidos',0,'omitidos',0);
      for fila in select * from jsonb_array_elements(coalesce(p->ent, '[]'::jsonb)) loop
        if coalesce(fila->>'clave','') = '' then
          cnt := jsonb_set(cnt, '{omitidos}', to_jsonb((cnt->>'omitidos')::int + 1));
          if jsonb_array_length(omit) < 200 then omit := omit || jsonb_build_object('entidad', ent, 'motivo', 'sin clave', 'dato', left(fila::text, 160)); end if;
          continue;
        end if;
        begin
          -- resolver referencias por clave
          for j in 1 .. array_length(refs, 1) loop
            if fila ? refs[j][1] then
              rid := public.crm__id(refs[j][3], fila->>refs[j][1]);
              if rid is null and coalesce(fila->>refs[j][1],'') <> '' then
                raise exception 'No existe % con clave %', refs[j][1], fila->>refs[j][1];
              end if;
              fila := (fila - refs[j][1]) || jsonb_build_object(refs[j][2], rid);
            end if;
          end loop;
          -- responde_a se resuelve en una segunda pasada (puede venir más abajo en el mismo archivo)
          res := public.crm__upsert(tabla, fila - 'contactos' - 'responde_a', p_modo, imp);
          if res->>'r' = 'alta' then
            cnt := jsonb_set(cnt, '{altas}', to_jsonb((cnt->>'altas')::int + 1));
            if ent = 'empresas' then nuevas_empresas := nuevas_empresas || (fila->>'clave'); end if;
          elsif res->>'r' = 'actualizada' then cnt := jsonb_set(cnt, '{actualizaciones}', to_jsonb((cnt->>'actualizaciones')::int + 1));
          else cnt := jsonb_set(cnt, '{sin_cambios}', to_jsonb((cnt->>'sin_cambios')::int + 1)); end if;

          for c in select * from jsonb_array_elements(coalesce(res->'conflictos','[]'::jsonb)) loop
            cnt := jsonb_set(cnt, '{conflictos}', to_jsonb((cnt->>'conflictos')::int + 1));
            if jsonb_array_length(confl) < 200 then confl := confl || (c || jsonb_build_object('entidad', ent, 'clave', fila->>'clave')); end if;
            insert into public.crm_revision (clave, tipo, entidad, entidad_clave, detalle, datos)
            values ('conflicto:'||tabla||':'||(fila->>'clave')||':'||(c->>'campo'), 'conflicto', ent, fila->>'clave',
                    'El dato "'||(c->>'campo')||'" llegó distinto en una importación. Se conservó el actual.', c)
            on conflict (clave) do update set datos = excluded.datos, estado = case when crm_revision.datos = excluded.datos then crm_revision.estado else 'abierta' end;
          end loop;

          -- contactos que participan en la conversación
          if ent = 'conversaciones' and jsonb_typeof(fila->'contactos') = 'array' then
            insert into public.crm_conversacion_contactos (conversacion_id, contacto_id)
            select public.crm__id('crm_conversaciones', fila->>'clave'), public.crm__id('crm_contactos', x)
            from jsonb_array_elements_text(fila->'contactos') x
            where public.crm__id('crm_contactos', x) is not null
            on conflict do nothing;
          end if;
        exception when others then
          if sqlstate = 'P0099' then raise; end if;
          cnt := jsonb_set(cnt, '{fallidos}', to_jsonb((cnt->>'fallidos')::int + 1));
          if jsonb_array_length(fall) < 200 then fall := fall || jsonb_build_object('entidad', ent, 'clave', fila->>'clave', 'error', sqlerrm); end if;
        end;
      end loop;
      rep := jsonb_set(rep, array['entidades', ent], cnt);
    end loop;

    -- segunda pasada: respuesta a qué actividad
    update public.crm_actividades a set responde_a = r.id
    from jsonb_array_elements(coalesce(p->'actividades','[]'::jsonb)) x
    join public.crm_actividades r on r.clave = x->>'responde_a'
    where a.clave = x->>'clave' and a.responde_a is distinct from r.id;

    -- coincidencias dudosas para las empresas nuevas: nunca se fusionan, quedan para revisión
    -- Solo valores que comparten 2 o 3 empresas: si un dato se repite en muchas (cadena, teléfono de relleno,
    -- sitio genérico) no sirve para detectar duplicados y se ignora. Tope de 500 avisos por importación.
    with nuevas as (select * from public.crm_empresas where clave = any(nuevas_empresas)),
    raros as (
      select 'n' k, nombre_norm v from public.crm_empresas where nombre_norm is not null group by nombre_norm having count(*) between 2 and 3
      union all
      select 'w', web_dominio from public.crm_empresas where web_dominio is not null group by web_dominio having count(*) between 2 and 3
      union all
      select 't', tel_digitos from public.crm_empresas where tel_digitos is not null group by tel_digitos having count(*) between 2 and 3
    ),
    pares as (
      select n.clave a, e.clave b, 'mismo nombre' motivo from nuevas n join raros r on r.k = 'n' and r.v = n.nombre_norm
        join public.crm_empresas e on e.nombre_norm = n.nombre_norm and e.clave <> n.clave
      union
      select n.clave, e.clave, 'misma web' from nuevas n join raros r on r.k = 'w' and r.v = n.web_dominio
        join public.crm_empresas e on e.web_dominio = n.web_dominio and e.clave <> n.clave
      union
      select n.clave, e.clave, 'mismo teléfono' from nuevas n join raros r on r.k = 't' and r.v = n.tel_digitos
        join public.crm_empresas e on e.tel_digitos = n.tel_digitos and e.clave <> n.clave
    ), ins as (
      insert into public.crm_revision (clave, tipo, entidad, entidad_clave, relacionada_clave, detalle)
      select 'dup:'||least(a,b)||'|'||greatest(a,b), 'posible_duplicado', 'empresas', least(a,b), greatest(a,b),
             'Posible duplicado ('||string_agg(distinct motivo, ', ')||'). No se fusionó.'
      from pares group by least(a,b), greatest(a,b)
      limit 500
      on conflict (clave) do nothing
      returning entidad_clave, relacionada_clave, detalle
    )
    select coalesce(jsonb_agg(to_jsonb(ins)), '[]'::jsonb) into coinc from (select * from ins limit 200) ins;

    rep := rep || jsonb_build_object('conflictos', confl, 'fallidos', fall, 'omitidos', omit, 'coincidencias', coinc);
    update public.crm_importaciones set resumen = rep - 'conflictos' - 'coincidencias' || jsonb_build_object('n_conflictos', jsonb_array_length(confl), 'n_coincidencias', jsonb_array_length(coinc)) where id = imp;

    if not p_aplicar then raise exception using errcode = 'P0099', message = 'vista previa'; end if;
  exception when sqlstate 'P0099' then
    null; -- vista previa: se deshizo todo
  end;
  if p_aplicar then rep := rep || jsonb_build_object('importacion_id', imp); end if;
  return rep;
end $$;

revoke execute on function public.crm_importar(jsonb, boolean, text, text) from anon;
revoke execute on function public.crm__upsert(text, jsonb, text, uuid) from anon;
grant execute on function public.crm_importar(jsonb, boolean, text, text) to authenticated;
