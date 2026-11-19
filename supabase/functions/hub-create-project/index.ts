// Nuevo proyecto (con su contrato) para un cliente existente, desde /clientes/admin.
import { crearProyecto, HttpError, parseProyecto, requireAdmin, serve } from '../_shared/hub.ts';

serve(async (req, b) => {
  await requireAdmin(req);
  const clienteId = Number(b.cliente_id);
  if (!Number.isInteger(clienteId) || clienteId <= 0) throw new HttpError(400, 'Elegí un cliente.');
  return { ok: true, ...(await crearProyecto(parseProyecto(b, clienteId))) };
});
