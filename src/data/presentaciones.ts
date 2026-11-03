// Presentaciones por rubro: genideiacompany.com/presentacion/<slug>
// (también presentacion.genideiacompany.com/<slug> cuando el subdominio esté apuntado).
// Para sumar un rubro: subir el video y su portada a public/videos/presentacion/ y agregar una entrada acá.
// Cada link es fijo: si se mejora el video de un rubro, se reemplaza el archivo y el link sigue sirviendo.
export type Presentacion = {
  slug: string;
  rubro: string;
  pregunta: string;
  video: string;
  poster: string;
  vertical?: boolean; // true si el video es 9:16
  recorrido?: Recorrido; // si existe, /presentacion/<slug> muestra el recorrido de varios videos
};

// Recorrido comercial: una presentación + soluciones, en orden. Los videos viven en public/videos/presentacion/<slug>/.
export type PasoRecorrido = {
  id: string;
  titulo: string;
  problema?: string; // frase breve que identifica el problema (solo soluciones)
  video: string;
  poster: string;
  duracion: number; // segundos
  siguiente?: string; // texto al terminar el video, antes del botón de continuar
};
export type Recorrido = {
  presentacion: PasoRecorrido;
  soluciones: PasoRecorrido[];
};

export const PRESENTACIONES: Presentacion[] = [
  {
    slug: 'distribuidora',
    rubro: 'distribuidoras',
    pregunta: '¿Cómo puedo ayudar a tu distribuidora?',
    video: '/videos/presentacion/distribuidora.mp4',
    poster: '/videos/presentacion/distribuidora-poster.jpg',
    vertical: true,
  },
  {
    slug: 'taller',
    rubro: 'talleres mecánicos',
    pregunta: '¿Cómo puedo ayudar a tu taller?',
    video: '/videos/presentacion/taller.mp4',
    poster: '/videos/presentacion/taller-poster.jpg',
    vertical: true,
    // Recorrido de 5 videos (presentación + 4 soluciones). Para cambiar un video: reemplazar el archivo en public/videos/presentacion/taller/ y ajustar `duracion`.
    recorrido: {
      presentacion: {
        id: 'presentacion',
        titulo: 'Presentación',
        video: '/videos/presentacion/taller/01-presentacion.mp4',
        poster: '/videos/presentacion/taller/01-presentacion-poster.jpg',
        duracion: 44.4,
      },
      soluciones: [
        {
          id: 'atencion',
          titulo: 'Atención por WhatsApp, llamadas y turnos',
          problema: 'Las llamadas y los mensajes interrumpen el trabajo del taller.',
          video: '/videos/presentacion/taller/02-atencion.mp4',
          poster: '/videos/presentacion/taller/02-atencion-poster.jpg',
          duracion: 48.8,
          siguiente: 'Ya viste cómo simplificar la atención. Ahora descubrí cómo organizar los trabajos dentro del taller.',
        },
        {
          id: 'organizacion',
          titulo: 'Organización interna del taller',
          problema: 'La información de cada trabajo queda repartida entre mecánicos, administración y dueño.',
          video: '/videos/presentacion/taller/03-organizacion.mp4',
          poster: '/videos/presentacion/taller/03-organizacion-poster.jpg',
          duracion: 61,
          siguiente: 'Ya viste cómo ordenar la información del taller. Ahora mirá cómo preparar presupuestos con menos idas y vueltas.',
        },
        {
          id: 'presupuestos',
          titulo: 'Presupuestos y proveedores',
          problema: 'Consultar proveedores y preparar presupuestos lleva un tiempo que el cliente no ve.',
          video: '/videos/presentacion/taller/04-presupuestos.mp4',
          poster: '/videos/presentacion/taller/04-presupuestos-poster.jpg',
          duracion: 54.3,
          siguiente: 'Ya viste cómo simplificar los presupuestos. Por último, cómo aprovechar el historial de cada vehículo.',
        },
        {
          id: 'historial',
          titulo: 'Historial y recordatorios',
          problema: 'El historial de cada vehículo queda guardado, pero casi no se usa para el seguimiento.',
          video: '/videos/presentacion/taller/05-historial.mp4',
          poster: '/videos/presentacion/taller/05-historial-poster.jpg',
          duracion: 51.6,
        },
      ],
    },
  },
];
