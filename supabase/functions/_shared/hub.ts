// Utilidades compartidas del Client Hub: CORS, verificación de admin y armado de proyecto + contrato.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';

const ALLOWED = ['https://genideiacompany.com', 'https://www.genideiacompany.com'];
export const isAllowedOrigin = (o: string) =>
  ALLOWED.includes(o) || /^https:\/\/[a-z0-9-]+\.genideia-web\.pages\.dev$/.test(o) || /^http:\/\/localhost:\d+$/.test(o);

export function corsHeaders(origin: string) {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
}

export class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

export const admin: SupabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Devuelve el id del usuario si es admin activo del hub; si no, corta con 403. */
export async function requireAdmin(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sesión requerida.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Sesión inválida.');
  const { data: p } = await admin.from('gen_hub_profiles').select('role, activo').eq('auth_user_id', data.user.id).maybeSingle();
  if (!p || p.role !== 'admin' || !p.activo) throw new HttpError(403, 'Solo administración.');
  return data.user.id;
}

export const str = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const opt = (v: unknown, max = 2000) => str(v, max) || null;
const esc = (s: string) => s.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]!));
const para = (s: string) => esc(s).replace(/\n+/g, '<br>');

export interface ProyectoInput {
  cliente_id: number;
  solucion: string;
  alcance: string;
  precio: number | null;
  moneda: 'USD' | 'UYU';
  plazo: string;
  forma_pago: string;
  garantia: string;
  presentacion_titulo: string | null;
  presentacion_pdf_url: string | null;
  presentacion_pptx_url: string | null;
}

export function parseProyecto(b: Record<string, unknown>, clienteId: number): ProyectoInput {
  const solucion = str(b.solucion, 200);
  if (!solucion) throw new HttpError(400, 'Definí la solución del proyecto.');
  const precio = typeof b.precio === 'number' && Number.isFinite(b.precio) && b.precio > 0 ? Math.round(b.precio * 100) / 100 : null;
  const url = (v: unknown) => { const s = str(v, 500); return /^https:\/\//.test(s) ? s : null; };
  return {
    cliente_id: clienteId,
    solucion,
    alcance: str(b.alcance, 6000),
    precio,
    moneda: b.moneda === 'UYU' ? 'UYU' : 'USD',
    plazo: str(b.plazo, 200),
    forma_pago: str(b.forma_pago, 1000),
    garantia: str(b.garantia, 1000),
    presentacion_titulo: opt(b.presentacion_titulo, 200),
    presentacion_pdf_url: url(b.presentacion_pdf_url),
    presentacion_pptx_url: url(b.presentacion_pptx_url),
  };
}

// TODO(Andrés): revisar el texto del contrato con un asesor antes del primer cliente real.
function contratoHtml(numero: string, cliente: Record<string, string | null>, p: ProyectoInput) {
  const parte = cliente.razon_social || cliente.nombre || 'El Cliente';
  const precio = p.precio ? `${p.moneda} ${p.precio.toLocaleString('es-UY', { minimumFractionDigits: 0 })}` : 'a definir en la propuesta';
  return `
<h2>Contrato de prestación de servicios · ${esc(numero)}</h2>
<p><b>Partes.</b> Por una parte, Carlos Andrés Albornoz, en nombre de GENIDEIA Company (en adelante, "GENIDEIA"), con domicilio en Montevideo, Uruguay. Por otra parte, ${esc(parte)}${cliente.rut ? `, RUT ${esc(cliente.rut)}` : ''}${cliente.rep_nombre ? `, representado por ${esc(cliente.rep_nombre)}` : ''} (en adelante, "el Cliente").</p>
<h4>1. Objeto</h4><p>GENIDEIA desarrollará e implementará para el Cliente la siguiente solución: <b>${esc(p.solucion)}</b>.</p>
<h4>2. Alcance</h4><p>${p.alcance ? para(p.alcance) : 'El alcance es el detallado en la propuesta comercial aceptada por el Cliente.'}</p>
<h4>3. Inversión y forma de pago</h4><p>La inversión total es de <b>${esc(precio)}</b>. ${p.forma_pago ? para(p.forma_pago) : 'Los pagos se realizan por transferencia bancaria o tarjeta, según los cobros que se publiquen en este portal.'}</p>
<h4>4. Plazo</h4><p>${p.plazo ? para(p.plazo) : 'El plazo de implementación es el indicado en la propuesta comercial.'} El plazo comienza a correr desde la firma de este contrato y la recepción de la información y los accesos necesarios.</p>
<h4>5. Garantía</h4><p>${p.garantia ? para(p.garantia) : 'GENIDEIA garantiza la correcta instalación y funcionamiento de la solución entregada según el alcance acordado.'}</p>
<h4>6. Mantenimiento</h4><p>Si se acuerda un servicio de mantenimiento mensual, este comienza a regir desde que la solución queda funcionando en producción.</p>
<h4>7. Obligaciones del Cliente</h4><p>El Cliente se compromete a brindar la información, accesos y validaciones necesarias en tiempo y forma. Las demoras en estas entregas extienden el plazo en igual medida.</p>
<h4>8. Confidencialidad</h4><p>Ambas partes mantendrán la confidencialidad de la información que reciban en el marco de este contrato, aun después de finalizado.</p>
<h4>9. Aceptación</h4><p>El Cliente declara haber leído y aceptado este contrato, que se firma electrónicamente desde el portal de clientes de GENIDEIA. La firma queda registrada con fecha y hora.</p>`.trim();
}

/** Crea proyecto + contrato pendiente de firma (+ presentación si vino). */
export async function crearProyecto(p: ProyectoInput) {
  const { data: cliente, error: ce } = await admin.from('gen_clientes').select('id, nombre, razon_social, rut, rep_nombre').eq('id', p.cliente_id).maybeSingle();
  if (ce || !cliente) throw new HttpError(404, 'Cliente no encontrado.');
  const { data: proyecto, error: pe } = await admin.from('gen_hub_proyectos').insert({
    cliente_id: p.cliente_id, nombre: p.solucion, alcance: p.alcance || null, precio: p.precio, moneda: p.moneda,
    plazo: p.plazo || null, forma_pago: p.forma_pago || null, garantia: p.garantia || null,
    proximo_paso: 'Firmar el contrato',
  }).select('id').single();
  if (pe) throw new HttpError(500, 'No se pudo crear el proyecto.');
  const numero = `GII-${new Date().getFullYear()}-${proyecto.id.slice(0, 8).toUpperCase()}`;
  const { error: ke } = await admin.from('gen_hub_contratos').insert({
    proyecto_id: proyecto.id, cliente_id: p.cliente_id, numero, contenido: contratoHtml(numero, cliente, p),
  });
  if (ke) { await admin.from('gen_hub_proyectos').delete().eq('id', proyecto.id); throw new HttpError(500, 'No se pudo generar el contrato.'); }
  if (p.presentacion_titulo || p.presentacion_pdf_url || p.presentacion_pptx_url) {
    await admin.from('gen_hub_presentaciones').insert({
      cliente_id: p.cliente_id, proyecto_id: proyecto.id, titulo: p.presentacion_titulo || `Propuesta · ${p.solucion}`,
      estado: 'enviada', visible_cliente: true, pdf_url: p.presentacion_pdf_url, pptx_url: p.presentacion_pptx_url,
    });
  }
  return { proyecto_id: proyecto.id, contrato: numero };
}

export function serve(handler: (req: Request, body: Record<string, unknown>) => Promise<unknown>) {
  Deno.serve(async (req) => {
    const headers = corsHeaders(req.headers.get('origin') || '');
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.');
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== 'object') throw new HttpError(400, 'Solicitud inválida.');
      return new Response(JSON.stringify(await handler(req, body)), { status: 200, headers });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      const message = err instanceof HttpError ? err.message : 'Error inesperado.';
      if (!(err instanceof HttpError)) console.error(err);
      return new Response(JSON.stringify({ error: message, message }), { status, headers });
    }
  });
}
