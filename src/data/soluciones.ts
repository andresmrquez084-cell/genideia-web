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
}

// Ejemplos ilustrativos del tipo de sistema que diseñamos por problema operativo.
// No son casos de cliente nombrados ni traen métricas — cuando existan casos reales
// con datos verificables, se reemplazan acá (ver feedback al final del PR).
export const SISTEMAS: Sistema[] = [
  {
    nombre: 'Seguimiento comercial',
    problema: 'Oportunidades sin seguimiento y vendedores dependiendo de memoria o WhatsApp.',
    sistema: 'Estados, responsables, alertas y seguimiento automático.',
    resultado: 'Mayor control y menos oportunidades olvidadas.',
  },
  {
    nombre: 'Gestión de personal',
    problema: 'Altas, vencimientos y documentación dispersa entre planillas y carpetas.',
    sistema: 'Panel único con estados, alertas de vencimiento y registro de movimientos.',
    resultado: 'Menos errores administrativos y control real del equipo.',
  },
  {
    nombre: 'Logística y transporte',
    problema: 'Pedidos y entregas sin trazabilidad, estados que dependen de llamadas.',
    sistema: 'Seguimiento de pedidos, remitos digitales y estados en tiempo real.',
    resultado: 'Visibilidad completa de cada entrega, sin depender de una persona.',
  },
  {
    nombre: 'Automatización administrativa',
    problema: 'Carga manual de datos, reportes armados a mano y errores recurrentes.',
    sistema: 'Captura automática de información, reportes generados solos y alertas ante errores.',
    resultado: 'Menos horas de carga manual y datos más confiables.',
  },
  {
    nombre: 'Paneles operativos',
    problema: 'Falta de visibilidad sobre lo que pasa en la operación día a día.',
    sistema: 'Panel interno con estados, alertas automáticas y datos centralizados.',
    resultado: 'Decisiones con información real, no con intuición.',
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
