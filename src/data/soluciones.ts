// Fuente única del nuevo posicionamiento B2B (2026-09): sistemas, automatización y procesos.
// No mezclar con contenido/marketing/ads — ver CLAUDE.md del proyecto y la decisión de Andrés.

export interface Problema {
  titulo: string;
  items: string[];
}

export const PROBLEMAS: Problema[] = [
  {
    titulo: 'Ventas y seguimiento',
    items: [
      'Leads sin responder',
      'Seguimientos manuales',
      'Cotizaciones',
      'Estados comerciales',
      'Oportunidades perdidas',
    ],
  },
  {
    titulo: 'Operaciones',
    items: [
      'Procesos repetitivos',
      'Tareas que dependen de memoria humana',
      'Responsables poco claros',
      'Falta de alertas',
      'Falta de visibilidad',
    ],
  },
  {
    titulo: 'Administración',
    items: [
      'Carga manual de datos',
      'Información dispersa',
      'Documentos',
      'Reportes',
      'Errores recurrentes',
    ],
  },
  {
    titulo: 'Personal',
    items: [
      'Altas',
      'Documentación',
      'Vencimientos',
      'Capacitaciones',
      'Movimientos',
      'Controles internos',
    ],
  },
  {
    titulo: 'Logística',
    items: [
      'Pedidos',
      'Entregas',
      'Movimientos',
      'Remitos',
      'Estados',
      'Trazabilidad',
    ],
  },
];

export interface Sistema {
  nombre: string;
  problema: string;
  sistema: string;
  resultado: string;
  url?: string;
  urlLabel?: string;
}

// Sistemas reales del portfolio de GENIDEIA (fuente: public/experiencia/base.html,
// el micro-site "Experiencia aplicada" ya construido — no inventar, solo curar y
// resumir al formato problema/sistema/resultado). Actualizar ambos lados si cambia
// uno: acá vive el resumen corto para home/casos, allá vive la ficha completa.
export const SISTEMAS: Sistema[] = [
  {
    nombre: 'GENIDEIA TMS',
    problema: 'Dar una vista común de la operación de transporte sin que WhatsApp y planillas terminen siendo el sistema central.',
    sistema: 'Solicitudes, viajes, conductores, vehículos, documentación y mantenimiento en un panel único, con alertas por evento.',
    resultado: 'Demo navegable pública — se puede probar en vivo.',
    url: 'https://genideia-tms.vercel.app/?pais=ar',
    urlLabel: 'Abrir demo navegable →',
  },
  {
    nombre: 'Sistema de membresías (Cevven)',
    problema: 'Evitar que membresías, renovaciones, pagos, reservas y control de acceso dependan de planillas, memoria y tareas separadas.',
    sistema: 'Socios, membresías, pagos, actividades, acceso y automatizaciones centralizados, con portal propio para cada socio.',
    resultado: 'Prototipo funcional ya construido.',
  },
  {
    nombre: 'Asistente de WhatsApp con IA',
    problema: 'Responder rápido sin obligar al profesional a interrumpir su trabajo por cada consulta.',
    sistema: 'Entiende texto y audio, consulta disponibilidad en Google Calendar, agenda, cancela, reagenda y hace seguimiento de indecisos.',
    resultado: 'Automatización funcional, en uso real.',
  },
  {
    nombre: 'GENIDEIA OS',
    problema: 'No depender de memoria, chats y documentos separados para dirigir la operación de la empresa.',
    sistema: 'Clientes, proyectos, diagnósticos, contenido y portfolio centralizados en un panel interno propio.',
    resultado: 'Sistema propio, en desarrollo — lo usamos día a día.',
  },
  {
    nombre: 'Firmador digital',
    problema: 'Reducir la fricción documental y centralizar el estado de la firma de contratos.',
    sistema: 'Carga, firma digital y estado del documento en un solo flujo.',
    resultado: 'Herramienta desarrollada y funcionando.',
    url: 'https://genideia-firmador.vercel.app/',
    urlLabel: 'Ver la herramienta →',
  },
];

export interface PasoTrabajo {
  num: string;
  nombre: string;
  desc: string;
}

export const PASOS_TRABAJO: PasoTrabajo[] = [
  {
    num: '01',
    nombre: 'Diagnóstico',
    desc: 'Analizamos cómo funciona hoy el proceso. Detectamos tareas repetitivas, pérdida de tiempo, errores, información dispersa, falta de seguimiento y oportunidades de automatización.',
  },
  {
    num: '02',
    nombre: 'Diseño',
    desc: 'Definimos el flujo, estados, responsables, información necesaria y funcionamiento del sistema.',
  },
  {
    num: '03',
    nombre: 'Construcción',
    desc: 'Desarrollamos la solución utilizando las herramientas necesarias.',
  },
  {
    num: '04',
    nombre: 'Implementación',
    desc: 'Conectamos el sistema con la operación real y migramos información cuando corresponde.',
  },
  {
    num: '05',
    nombre: 'Capacitación y mejora',
    desc: 'El equipo aprende a usarlo y se ajusta el sistema según el uso real.',
  },
];

export const DIFERENCIALES = {
  no: [
    'No vendemos herramientas cerradas.',
    'No imponemos software genérico.',
    'No automatizamos por automatizar.',
  ],
  si: [
    'Primero entendemos el problema.',
    'Después diseñamos el sistema.',
    'Usamos IA, automatización, bases de datos e integraciones solo cuando tienen sentido.',
  ],
};
