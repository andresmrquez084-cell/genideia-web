// Propuestas comerciales en video: genideiacompany.com/propuesta/<slug>
// A diferencia de /presentacion/<rubro> (genérica por rubro), cada link le habla a un cliente puntual.
// No se indexa (noindex) y no está enlazada desde el sitio: se comparte solo con el cliente.
// Para sumar una: subir los videos y portadas a public/videos/propuesta/<slug>/ y agregar una entrada acá.
import type { Recorrido, TextosRecorrido } from './presentaciones';

export type Propuesta = {
  slug: string;
  cliente: string;
  titulo: string;      // h1
  descripcion: string; // meta description
  waTexto: string;
  recorrido: Recorrido;
  textos: TextosRecorrido;
};

const V = '/videos/propuesta/avl';

export const PROPUESTAS: Propuesta[] = [
  {
    slug: 'avl',
    cliente: 'AVL Estudio Jurídico',
    titulo: 'Un sistema integral para AVL, en cuatro fases',
    descripcion: 'Propuesta de GENIDEIA para AVL Estudio Jurídico: cómo funcionaría el sistema, fase por fase.',
    waTexto: 'Hola Andrés, vimos la propuesta para AVL y queremos coordinar el diagnóstico.',
    // Para cambiar un video: reemplazar el archivo en public/videos/propuesta/avl/ y ajustar `duracion`.
    recorrido: {
      presentacion: { id: 'presentacion', titulo: 'Presentación', video: `${V}/01-presentacion.mp4`, poster: `${V}/01-presentacion-poster.jpg`, duracion: 63.9 },
      soluciones: [
        {
          id: 'correo',
          titulo: 'Fase 1 · Correo y pendientes',
          problema: 'Una parte importante del tiempo de los socios se va en gestionar correos y perseguir pendientes.',
          video: `${V}/02-correo.mp4`, poster: `${V}/02-correo-poster.jpg`, duracion: 69,
          siguiente: 'Ya vieron cómo ordenar el correo y los pendientes. Ahora, la facturación y las comisiones.',
        },
        {
          id: 'facturacion',
          titulo: 'Fase 2 · Facturación y comisiones',
          problema: 'Más de 200 facturas y unas 40 horas de socios por mes en cálculos manuales.',
          video: `${V}/03-facturacion.mp4`, poster: `${V}/03-facturacion-poster.jpg`, duracion: 73.5,
          siguiente: 'Ya vieron la facturación y las comisiones. Ahora, el camino de una propuesta hasta el cliente operativo.',
        },
        {
          id: 'altas',
          titulo: 'Fase 3 · Propuestas, contratos y altas',
          problema: 'Los mismos datos se piden y se copian varias veces hasta que un cliente nuevo empieza a trabajar.',
          video: `${V}/04-altas.mp4`, poster: `${V}/04-altas-poster.jpg`, duracion: 61.3,
          siguiente: 'Ya vieron cómo ordenar las altas. Por último, cobranzas, trámites y tributario, y el primer paso.',
        },
        {
          id: 'cobranzas',
          titulo: 'Fase 4 · Cobranzas, trámites y tributario',
          problema: 'Los procesos con más urgencias dependen hoy de un seguimiento manual.',
          video: `${V}/05-cobranzas.mp4`, poster: `${V}/05-cobranzas-poster.jpg`, duracion: 108.1,
        },
      ],
    },
    textos: {
      eyebrow: 'Propuesta para AVL Estudio Jurídico',
      lead: 'Empiecen por esta presentación. Después, un video corto por cada fase.',
      rutaSoluciones: '4 fases',
      rutaFin: 'Diagnóstico',
      finPresentacion: 'Ahora vean cómo funcionaría cada una de las cuatro fases.',
      btnPresentacion: 'Ver la fase 1',
      saltarPresentacion: 'Ir a las fases',
      solEyebrow: 'Fases',
      solTitulo: 'Cómo funcionaría el sistema, fase por fase',
      badge: 'Fase',
      siguienteBtn: 'Ver la fase siguiente',
      finUltimo: 'Estas son las cuatro fases que identificamos.<br /><strong>El primer paso es un diagnóstico con su equipo.</strong>',
      btnUltimo: 'Coordinar el diagnóstico',
      contactoTitulo: '¿Coordinamos el diagnóstico con su equipo?',
      contactoLead: 'Nos reunimos con los responsables de cada área, validamos las integraciones y definimos juntos por qué fase conviene empezar.',
      contactoBtn: 'Escribirle a Andrés por WhatsApp',
      nota: 'Respondo personalmente.',
    },
  },
];
