# Planes públicos de alumnos — Genideia Academy

## Regla

El plan compartible de un alumno **no se diseña como una página HTML independiente**.

La fuente de verdad es:

`academy/data/public-plans.json`

Cada alumno que tenga un registro en ese archivo obtiene automáticamente una página pública bajo:

`https://genideiacompany.com/academy/alumnos/{slug}`

## Alta de un alumno

Cuando se crea o actualiza el contexto de un alumno:

1. resumir únicamente la información adecuada para compartir públicamente;
2. definir objetivo general;
3. definir proyectos/casos que van a guiar la formación;
4. adaptar los 8 módulos;
5. marcar estado de cada módulo;
6. guardar el registro en `public-plans.json`;
7. vincular el perfil interno de Academy a la URL pública.

No crear `plan-{alumno}.html`.

## Qué contiene el plan público

- nombre;
- estado;
- introducción;
- objetivo;
- metodología;
- proyectos/casos;
- módulos;
- estado de cada módulo;
- resultado esperado;
- regla de trabajo.

## Qué NO debe publicarse

No incluir:

- datos personales sensibles;
- teléfonos;
- emails privados;
- documentos;
- información de pago;
- credenciales;
- información comercial confidencial;
- notas internas del instructor.

El contexto interno puede ser más amplio que el plan compartible.

## Actualización

Cuando cambia el progreso del alumno, se actualiza el mismo registro.

La URL no cambia.

Ejemplo:

`https://genideiacompany.com/academy/alumnos/mauro`

El plan público se regenera con el siguiente deploy.
