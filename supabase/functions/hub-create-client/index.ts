// Alta de cliente desde /clientes/admin: usuario del portal + ficha + primer proyecto con contrato.
import { admin, crearProyecto, HttpError, opt, parseProyecto, requireAdmin, serve, str } from '../_shared/hub.ts';

serve(async (req, b) => {
  await requireAdmin(req);
  const nombre = str(b.nombre_cliente, 160);
  if (!nombre) throw new HttpError(400, 'Ingresá el nombre del cliente.');
  const username = str(b.username, 40).toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(username) || username === 'genideia') throw new HttpError(400, 'Usuario inválido (3 a 40 letras, números, punto o guion).');
  const password = typeof b.password === 'string' ? b.password : '';
  if (password.length < 10) throw new HttpError(400, 'La contraseña debe tener al menos 10 caracteres.');
  const email = str(b.email, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpError(400, 'Email inválido.');

  const { data: existing } = await admin.from('gen_hub_profiles').select('username').eq('username', username).maybeSingle();
  if (existing) throw new HttpError(409, 'Ese usuario ya existe.');

  parseProyecto(b, 0); // valida los datos del proyecto antes de crear nada

  const { data: cliente, error: ce } = await admin.from('gen_clientes').insert({
    nombre, razon_social: opt(b.razon_social, 200), rut: opt(b.rut, 40), email, whatsapp: opt(b.whatsapp, 40),
    rep_nombre: opt(b.nombre_contacto, 160), tipo: b.tipo_cliente === 'persona' ? 'persona' : 'empresa',
    nombre_portada: opt(b.nombre_portada, 160) || nombre, logo_url: /^https:\/\//.test(str(b.logo_url, 500)) ? str(b.logo_url, 500) : null,
  }).select('id').single();
  if (ce) throw new HttpError(500, 'No se pudo crear la ficha del cliente.');

  const { data: user, error: ue } = await admin.auth.admin.createUser({
    email: `${username}@hub.genideia.local`, password, email_confirm: true, user_metadata: { username },
  });
  if (ue || !user.user) {
    await admin.from('gen_clientes').delete().eq('id', cliente.id);
    throw new HttpError(500, 'No se pudo crear el usuario del portal.');
  }
  const { error: pe } = await admin.from('gen_hub_profiles').insert({
    auth_user_id: user.user.id, username, nombre: opt(b.nombre_contacto, 160) || nombre, role: 'client',
    cliente_id: cliente.id, empresa_nombre: nombre,
  });
  if (pe) {
    await admin.auth.admin.deleteUser(user.user.id);
    await admin.from('gen_clientes').delete().eq('id', cliente.id);
    throw new HttpError(500, 'No se pudo crear el perfil del cliente.');
  }

  const proyecto = await crearProyecto(parseProyecto(b, cliente.id));
  return { ok: true, username, cliente_id: cliente.id, ...proyecto };
});
