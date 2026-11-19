// API del CRM GENIDEIA para asistentes. Proyecto Supabase del CRM (fzrrbqqvteyuwbvfgvnx), NO el de la Academy.
// Autenticación: encabezado x-api-key. En la base solo se guarda el sha256 de la clave (tabla crm_api_keys).
// Deploy: supabase functions deploy crm-api --project-ref fzrrbqqvteyuwbvfgvnx --no-verify-jwt --use-api
// Todas las escrituras pasan por crm_importar: idempotentes por clave y con historial de cambios.
// Registrar o programar algo acá nunca envía mensajes a prospectos.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const MAX_BODY = 2 * 1024 * 1024;
const H = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
class E extends Error { constructor(public status: number, msg: string) { super(msg); } }

async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
async function auth(req: Request) {
  const key = req.headers.get('x-api-key') || '';
  if (key.length < 32) throw new E(401, 'Falta la clave de API (x-api-key).');
  const { data } = await db.from('crm_api_keys').select('id, nombre, activo').eq('hash', await sha256(key)).maybeSingle();
  if (!data || !data.activo) throw new E(401, 'Clave de API inválida.');
  await db.from('crm_api_keys').update({ ultimo_uso: new Date().toISOString() }).eq('id', data.id);
  return data.nombre as string;
}
const s = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const ok = (r: { data: unknown; error: { message: string } | null }) => { if (r.error) throw new E(400, r.error.message); return r.data; };
async function importar(payload: unknown, aplicar: boolean, modo: string, quien: string) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new E(400, 'payload debe ser un objeto genideia-crm/2.');
  return ok(await db.rpc('crm_importar', { p: payload, p_aplicar: aplicar, p_modo: modo === 'actualizar' ? 'actualizar' : 'completar', p_archivo: 'api · ' + quien }));
}

const ACCIONES: Record<string, (b: Record<string, any>, quien: string) => Promise<unknown>> = {
  async buscar_empresas(b) {
    let q = db.from('crm_v_empresas').select('id,clave,nombre,rubro,pais,ciudad,origen,etapa,atencion,ultimo_saliente,ultima_respuesta,sin_desglosar,proxima_accion,proxima_fecha,no_contactar,error_canal', { count: 'exact' });
    if (s(b.q)) q = q.ilike('busqueda', '%' + s(b.q).replace(/[%_,()*\\]/g, ' ') + '%');
    if (s(b.clave)) q = q.eq('clave', s(b.clave));
    if (s(b.etapa)) q = q.eq('etapa', s(b.etapa));
    if (s(b.atencion)) q = q.eq('atencion', s(b.atencion));
    const lim = Math.min(Math.max(Number(b.limite) || 25, 1), 100), desde = Math.max(Number(b.desde) || 0, 0);
    const r = await q.order('nombre').range(desde, desde + lim - 1);
    if (r.error) throw new E(400, r.error.message);
    return { total: r.count, desde, empresas: r.data };
  },
  async ficha(b) {
    let id = s(b.empresa_id, 40);
    if (!id && s(b.clave)) id = (ok(await db.from('crm_empresas').select('id').eq('clave', s(b.clave)).maybeSingle()) as any)?.id;
    if (!id) throw new E(404, 'Empresa no encontrada.');
    return ok(await db.rpc('crm_ficha', { p_empresa: id }));
  },
  importar: (b, quien) => importar(b.payload, b.aplicar === true, s(b.modo), quien),
  registrar_actividad(b, quien) {
    const a = b.actividad || {};
    if (!s(a.empresa) || !s(a.tipo) || !s(a.direccion)) throw new E(400, 'actividad necesita empresa (clave), tipo y direccion.');
    if (!s(a.clave) && !s(a.message_id)) throw new E(400, 'actividad necesita clave o message_id para no duplicar.');
    a.clave = s(a.clave) || 'msg:' + s(a.message_id);
    a.fecha_precision = a.fecha_hecho ? (a.fecha_precision || 'exacta') : 'sin_verificar';
    a.fecha_reporte = a.fecha_reporte || new Date().toISOString();
    const p: Record<string, unknown> = { actividades: [a] };
    if (b.conversacion) p.conversaciones = [b.conversacion];
    return importar(p, b.aplicar !== false, 'completar', quien);
  },
  crear_tarea(b, quien) {
    const t = b.tarea || {};
    if (!s(t.empresa) || !s(t.accion)) throw new E(400, 'tarea necesita empresa (clave) y accion.');
    t.clave = s(t.clave) || 'api:' + crypto.randomUUID();
    t.estado = t.estado || 'pendiente';
    t.origen = t.origen || 'API · ' + quien;
    return importar({ tareas: [t] }, b.aplicar !== false, 'actualizar', quien);
  },
  async tareas(b) {
    let q = db.from('crm_v_tareas').select('clave,empresa,empresa_clave,accion,fecha,responsable,estado,origen').eq('estado', s(b.estado) || 'pendiente');
    if (s(b.hasta, 10)) q = q.lte('fecha', s(b.hasta, 10));
    return ok(await q.order('fecha', { nullsFirst: false }).limit(Math.min(Number(b.limite) || 100, 500)));
  },
  tandas: async () => ok(await db.from('crm_v_tandas').select('*').order('fecha', { ascending: false })),
  metricas: async (b) => ok(await db.rpc('crm_metricas', { p_ventana_dias: Math.min(Math.max(Number(b.ventana_dias) || 3, 1), 60) })),
  exportar: async () => ok(await db.rpc('crm_exportar')),
};

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') throw new E(405, 'Usá POST con JSON: {"accion": "...", ...}');
    const quien = await auth(req);
    const raw = await req.text();
    if (raw.length > MAX_BODY) throw new E(413, 'El cuerpo supera 2 MB. Partí la importación en tandas.');
    let b: Record<string, any>;
    try { b = JSON.parse(raw); } catch { throw new E(400, 'JSON inválido.'); }
    const fn = ACCIONES[s(b.accion, 40)];
    if (!fn) throw new E(400, 'Acción desconocida. Opciones: ' + Object.keys(ACCIONES).join(', '));
    return new Response(JSON.stringify({ ok: true, datos: await fn(b, quien) }), { status: 200, headers: H });
  } catch (err) {
    const status = err instanceof E ? err.status : 500;
    if (!(err instanceof E)) console.error(err);
    return new Response(JSON.stringify({ ok: false, error: err instanceof E ? err.message : 'Error inesperado.' }), { status, headers: H });
  }
});
