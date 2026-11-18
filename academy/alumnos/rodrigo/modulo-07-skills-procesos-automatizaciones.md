# Módulo 07 — Skills, procesos y automatizaciones

## Estado actual

**En curso**

Rodrigo llegó a este módulo de forma anticipada a partir de necesidades reales. Ya construyó Skills antes de completar todos los módulos intermedios.

La prioridad actual no es crear más Skills, sino **estabilizar lo que ya existe y convertirlo en procesos repetibles antes de automatizar**.

## Objetivo

Pasar de una Skill que funciona en una prueba a un proceso que:

- pueda repetirse;
- use datos claros;
- valide antes de ejecutar;
- corrija cuando corresponda;
- sepa cuándo detenerse;
- pueda programarse sin perder control humano.

## Principio

> No automatizar un proceso que todavía cambia o no produce un resultado confiable.

Nueva secuencia de trabajo:

**SKILL → PRUEBA → ESTABILIDAD → DATOS → PROCESO → DECISIONES → LOOP → APROBACIÓN → PROGRAMACIÓN**

## Caso principal actual — Banners

### Estado

La Skill fue corregida intensivamente en la sesión del 11/11/2026 y terminó con una base funcional.

Todavía falta demostrar estabilidad fuera de la clase.

### Reglas ya trabajadas

- producto como protagonista;
- texto recto y formal;
- logos reconocibles y en segundo plano;
- jerarquía visual según objetivo;
- oferta con mayor peso cuando corresponda;
- preservar esencia del producto/envase;
- consultar la web y categoría correspondiente;
- actualizar la Skill cuando una corrección general queda validada.

## Checkpoint obligatorio antes de avanzar

Antes de construir la automatización:

1. ejecutar la Skill sobre casos reales;
2. comprobar que no necesita reconstrucción;
3. registrar correcciones;
4. separar corrección puntual de regla general;
5. actualizar la Skill solo cuando la regla sea reutilizable.

### Resultado del checkpoint

Clasificar:

- INESTABLE
- FUNCIONAL PERO MANUAL
- ESTABLE PARA CONVERTIR EN PROCESO

## Siguiente etapa — Fuente de datos

Definir mediante preguntas:

- qué información es fija;
- qué información varía;
- qué información obtiene Claude desde la web;
- qué información aporta Rodrigo;
- qué datos necesitan fecha/vigencia;
- qué tipos de banner existen;
- qué información debe poder actualizar Rodrigo sin tocar la Skill.

No imponer una tabla antes de entender el proceso.

## Proceso esperado de banners

### Camino normal

**ACTIVACIÓN → LEER DATOS → VALIDAR → VERIFICAR STOCK → GENERAR → REVISAR → APROBACIÓN**

### Loop de validación previa

Si falta información o stock:

**DETECTAR → RESOLVER SEGÚN REGLA / CONSULTAR → VOLVER A VALIDAR**

### Loop de revisión posterior

Si el banner no cumple:

**DETECTAR ERROR → CORREGIR → VOLVER A REVISAR**

### Aprobación humana

El resultado correcto pasa a:

**PARA APROBACIÓN**

Si Rodrigo pide corrección, vuelve al loop de corrección.

Si no responde, se aplica un sistema limitado de recordatorios; nunca se interpreta silencio como aprobación.

## Programación local

La intención es ejecutar el proceso uno o dos días por semana.

Regla acordada:

> Existe un horario objetivo. Si la computadora está apagada, la ejecución no se pierde: debe ejecutarse cuando vuelva a estar disponible, siempre que no haya sido realizada y todavía corresponda.

Debe existir protección contra duplicados.

## Próximo resultado concreto

Dejar una primera automatización de banners que:

- seleccione únicamente casos permitidos;
- verifique información y stock;
- ejecute la Skill;
- revise el resultado;
- deje el banner para aprobación;
- registre bloqueos y correcciones.

Las ofertas, promociones especiales o casos que dependen del criterio comercial de Rodrigo deben tratarse como entradas explícitas, no inventarse.

## Criterio de avance

Se avanza cuando Rodrigo puede:

- usar la Skill sin reconstruirla;
- explicar de dónde salen los datos;
- explicar qué valida el proceso;
- explicar qué ocurre si falta información o stock;
- identificar dónde existe un loop;
- explicar qué puede resolver solo y qué requiere una persona;
- ejecutar pruebas sin descubrir pasos estructurales nuevos en cada intento.

## Regla metodológica para futuras clases

Cada clase nueva debe comenzar con un checkpoint breve.

Si lo anterior falla:

**RECUPERAR → CORREGIR → PROBAR → CERRAR**

y recién después avanzar.

La recuperación debe tener recursos preparados para evitar convertir la clase completa en improvisación.
