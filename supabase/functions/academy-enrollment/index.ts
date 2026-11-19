// Inscripción de Genideia Academy: guarda datos + firma, método de pago y comprobante.
// La llama /academy-onboarding.js sin sesión; cada inscripción se protege con un
// token propio (solo se guarda su hash). Usa service_role, que Supabase inyecta solo.
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const ALLOWED_ORIGINS = [
  'https://genideiacompany.com',
  'https://www.genideiacompany.com',
  'https://andres.genideiacompany.com',
];
const isAllowedOrigin = (o: string) =>
  ALLOWED_ORIGINS.includes(o) ||
  /^https:\/\/[a-z0-9-]+\.genideia-web\.pages\.dev$/.test(o) ||
  /^http:\/\/localhost:\d+$/.test(o);

const BUCKET = 'academy-enrollments';
const MAX_BODY = 12 * 1024 * 1024;
const MAX_SIGNATURE = 1024 * 1024;
const MAX_PROOF = 8 * 1024 * 1024;
const PROOF_TYPES: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf',
};

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

function cors(origin: string) {
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
    'Vary': 'Origin',
  };
}
class HttpError extends Error { constructor(public status: number, msg: string) { super(msg); } }

const text = (v: unknown, name: string, min: number, max: number) => {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '';
  if (s.length < min || s.length > max) throw new HttpError(400, `Revisá el campo ${name}.`);
  return s;
};
async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function parseDataUrl(v: unknown, max: number, types: string[]) {
  const m = typeof v === 'string' && v.match(/^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)$/i);
  if (!m) throw new HttpError(400, 'Archivo inválido.');
  const type = m[1].toLowerCase();
  if (!types.includes(type)) throw new HttpError(400, 'Formato de archivo no permitido.');
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  if (bytes.length > max) throw new HttpError(400, 'El archivo es demasiado grande.');
  return { type, bytes };
}
async function findEnrollment(body: Record<string, unknown>) {
  const id = typeof body.enrollment_id === 'string' ? body.enrollment_id : '';
  const token = typeof body.client_token === 'string' ? body.client_token : '';
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f]{64}$/i.test(token)) throw new HttpError(401, 'Inscripción no válida.');
  const { data, error } = await db.from('academy_enrollments').select('id, client_token_hash, status').eq('id', id).maybeSingle();
  if (error) throw new HttpError(500, 'No se pudo verificar la inscripción.');
  if (!data || data.client_token_hash !== (await sha256(token))) throw new HttpError(401, 'Inscripción no válida.');
  return data;
}

async function create(body: Record<string, unknown>) {
  const service = body.service_type;
  if (service !== 'grupal' && service !== '1a1') throw new HttpError(400, 'Programa no válido.');
  if (body.contract_accepted !== true) throw new HttpError(400, 'Tenés que aceptar el contrato.');
  const email = text(body.email, 'email', 5, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'Revisá el campo email.');
  const row = {
    service_type: service,
    full_name: text(body.full_name, 'nombre', 2, 160),
    document_number: text(body.document_number, 'documento', 3, 40),
    country: text(body.country, 'país', 2, 80),
    city: text(body.city, 'ciudad', 2, 80),
    address: text(body.address, 'dirección', 3, 200),
    email,
    whatsapp: text(body.whatsapp, 'WhatsApp', 6, 40),
    contract_accepted: true,
  };
  const signature = parseDataUrl(body.signature_data_url, MAX_SIGNATURE, ['image/png']);
  const id = crypto.randomUUID();
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const path = `${id}/firma.png`;
  const up = await db.storage.from(BUCKET).upload(path, signature.bytes, { contentType: 'image/png', upsert: false });
  if (up.error) throw new HttpError(500, 'No se pudo guardar la firma.');
  const { error } = await db.from('academy_enrollments').insert({ id, ...row, signature_path: path, client_token_hash: await sha256(token) });
  if (error) {
    await db.storage.from(BUCKET).remove([path]);
    throw new HttpError(500, 'No se pudo guardar la inscripción.');
  }
  return { enrollment_id: id, client_token: token };
}

async function setPaymentMethod(body: Record<string, unknown>) {
  const e = await findEnrollment(body);
  const method = body.payment_method;
  if (method !== 'payoneer' && method !== 'transfer') throw new HttpError(400, 'Método de pago no válido.');
  const { error } = await db.from('academy_enrollments').update({ payment_method: method }).eq('id', e.id);
  if (error) throw new HttpError(500, 'No se pudo guardar el método de pago.');
  return { ok: true };
}

async function uploadProof(body: Record<string, unknown>) {
  const e = await findEnrollment(body);
  const method = body.payment_method;
  if (method !== 'payoneer' && method !== 'transfer') throw new HttpError(400, 'Método de pago no válido.');
  const file = parseDataUrl(body.proof_data_url, MAX_PROOF, Object.keys(PROOF_TYPES));
  const path = `${e.id}/comprobante-${Date.now()}.${PROOF_TYPES[file.type]}`;
  const up = await db.storage.from(BUCKET).upload(path, file.bytes, { contentType: file.type, upsert: false });
  if (up.error) throw new HttpError(500, 'No se pudo guardar el comprobante.');
  const { error } = await db.from('academy_enrollments')
    .update({ payment_method: method, proof_path: path, status: e.status === 'pagado' ? 'pagado' : 'comprobante_enviado' })
    .eq('id', e.id);
  if (error) throw new HttpError(500, 'No se pudo registrar el comprobante.');
  return { ok: true };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const headers = { ...cors(origin), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Método no permitido.');
    if (origin && !isAllowedOrigin(origin)) throw new HttpError(403, 'Origen no permitido.');
    if (Number(req.headers.get('content-length') || 0) > MAX_BODY) throw new HttpError(413, 'La solicitud es demasiado grande.');
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new HttpError(400, 'Solicitud inválida.');
    const actions: Record<string, (b: Record<string, unknown>) => Promise<unknown>> = {
      create, set_payment_method: setPaymentMethod, upload_proof: uploadProof,
    };
    const fn = actions[String(body.action)];
    if (!fn) throw new HttpError(400, 'Acción no válida.');
    return new Response(JSON.stringify(await fn(body)), { status: 200, headers });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof HttpError ? err.message : 'Error inesperado. Probá de nuevo.';
    if (!(err instanceof HttpError)) console.error(err);
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
});
