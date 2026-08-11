// Ejemplos de soluciones clasificados por rubro — usado por /ejemplos (standalone)
// y por el bloque 03 de /andres (cascada). Única fuente para no desincronizar contenido.
// Rubros nuevos se agregan acá a medida que se van teniendo diagnósticos reales.
export type RubroEjemplo = { titulo: string; desc: string };
export type Rubro = { id: string; label: string; video: string; items: RubroEjemplo[] };

export const RUBROS_EJEMPLOS: Rubro[] = [
  {
    id: 'transporte',
    label: 'Transporte',
    video: '/videos/ejemplos-transporte.mp4',
    items: [
      { titulo: 'Solicitudes centralizadas', desc: 'Los pedidos que hoy entran dispersos por WhatsApp, llamadas y email quedan en un solo lugar, con estado y seguimiento en tiempo real.' },
      { titulo: 'Historial de condiciones de rutas', desc: 'Registro de las mejores rutas y caminos — estado, obstrucciones, restricciones de altura — para planificar cada traslado.' },
      { titulo: 'Mantenimiento de flota', desc: 'Alertas automáticas por kilometraje y fecha, con historial completo de cada camión: qué se cambió, qué se gastó, cuándo.' },
      { titulo: 'Remitos digitales', desc: 'El remito enviado por WhatsApp queda guardado y organizado por cliente, tipo de viaje y flota — sin papeles ni chats perdidos.' },
      { titulo: 'Historial completo de la empresa', desc: 'Viajes, remitos, mantenimientos e incidencias organizados en un solo lugar, en vez de dispersos en archivos y conversaciones.' },
      { titulo: 'Gestión de encomiendas', desc: 'Cada carga tiene un código único: se escanea al cambiar de vehículo o destino, y el cliente consulta el estado sin llamar a nadie. Entrega confirmada con foto o firma digital.' },
    ],
  },
  {
    id: 'automotriz',
    label: 'Automotriz',
    video: '',
    items: [],
  },
];
