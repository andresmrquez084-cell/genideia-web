// Fuente única de verdad para clientes/proyectos reales.
// Antes había dos listas (logos + confiaron) en index.astro con rubros inconsistentes
// y un mismo dominio (lorena-imperium-landing...) tratado como 2 clientes distintos.
// Se unificaron acá. La categoría de servicio es una inferencia a partir de la
// descripción disponible — confirmar con Andrés (ver CONTENIDO-PENDIENTE.md).

export type ServicioSlug = 'contenido-marketing' | 'anuncios' | 'presencia-digital' | 'automatizaciones';

export type TipoEvidencia = 'real' | 'prototipo' | 'demostracion';

export interface Cliente {
  nombre: string;
  rubro: string;
  url: string;
  servicio: ServicioSlug;
  tipo: TipoEvidencia;
  /** Narrativa corta, solo cuando hay info verificable (ver feed.astro). No inventar. */
  situacion?: string;
}

export const clientes: Cliente[] = [
  {
    nombre: 'Sara',
    rubro: 'Centro estético',
    url: 'https://centroesteticosara.netlify.app',
    servicio: 'contenido-marketing',
    tipo: 'real',
    situacion: 'Construcción de presencia digital y marketing de contenido.',
  },
  {
    nombre: 'Hecho con el Alma',
    rubro: 'Curaduría de arte',
    url: 'https://hechoconelalma.shop',
    servicio: 'contenido-marketing',
    tipo: 'real',
    situacion: 'Plataforma que conecta artistas uruguayos con compradores de arte: web, sistema de contenido y estructura de conversión.',
  },
  {
    nombre: "Donher's",
    rubro: 'Relojes y accesorios',
    url: 'https://donhers.com',
    servicio: 'presencia-digital',
    tipo: 'real',
  },
  {
    nombre: 'TBO Express',
    rubro: 'Cadetería y delivery',
    url: 'https://cadete-web.vercel.app',
    servicio: 'presencia-digital',
    tipo: 'real',
  },
  {
    nombre: 'Asesores de Imperium',
    rubro: 'Inmobiliaria',
    url: 'https://lorena-imperium-landing.genideiaconsultoraia.workers.dev',
    // Todavía no hay casos reales de automatización confirmados (llegan la semana que viene) — no tagear como 'automatizaciones'.
    servicio: 'presencia-digital',
    tipo: 'real',
  },
  {
    nombre: 'Vanzza',
    rubro: 'Carteras y accesorios',
    url: 'https://vanzza-prototipo.vercel.app',
    servicio: 'presencia-digital',
    tipo: 'prototipo',
  },
  {
    nombre: 'DMJ Studio',
    rubro: 'Barbería y estética masculina',
    url: 'https://dmj-studio.com',
    servicio: 'presencia-digital',
    tipo: 'real',
  },
];

export const serviciosInfo: Record<ServicioSlug, { nombre: string; color: string; ruta: string }> = {
  'contenido-marketing': { nombre: 'Contenido y marketing', color: '#00C8FF', ruta: '/servicios/contenido-marketing' },
  anuncios: { nombre: 'Anuncios', color: '#22D3EE', ruta: '/servicios/anuncios' },
  'presencia-digital': { nombre: 'Presencia digital', color: '#007BFF', ruta: '/servicios/presencia-digital' },
  automatizaciones: { nombre: 'Automatizaciones', color: '#34D399', ruta: '/servicios/automatizaciones' },
};
