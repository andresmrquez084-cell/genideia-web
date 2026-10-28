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
];
