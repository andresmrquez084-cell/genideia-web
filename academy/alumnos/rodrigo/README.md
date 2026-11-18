# Rodrigo Pereira — Plan personalizado

## Estado actual

**Programa:** En curso  
**Etapa actual:** Skills, procesos y automatizaciones  
**Última sesión analizada:** 11/11/2026  
**Ritmo recomendado:** 1 clase por semana, con ejecución práctica breve entre clases.

## Objetivo general

Construir una secretaria/asistente interno de IA que acumule conocimiento operativo, investigue, analice y prepare información para liberar tiempo de Rodrigo y del equipo, sin reemplazar la relación humana con los clientes.

## Principio pedagógico

**NECESIDAD REAL → CONSTRUIR → PROBAR → ESTABILIZAR → DOCUMENTAR → REUTILIZAR → RECIÉN DESPUÉS AUTOMATIZAR**

La presentación es una guía. La clase la dirige el problema real, pero no se avanza a una capa nueva si el resultado anterior todavía no es estable.

## Regla nueva de avance

Antes de cada clase nueva se hace un checkpoint corto:

1. probar lo construido en la sesión anterior;
2. confirmar si Rodrigo pudo usarlo solo;
3. detectar errores o correcciones pendientes;
4. si está estable, avanzar;
5. si no está estable, usar un recurso de recuperación ya preparado;
6. cerrar la corrección con pruebas antes de seguir.

La meta es evitar sesiones largas de improvisación y llegar a clase con recursos listos para ejecutar.

## Norte del programa

**CLIENTE → RODRIGO / VENDEDOR → IA PREPARA INFORMACIÓN → HUMANO REVISA → HUMANO RESPONDE**

## Avances confirmados

- Rodrigo ya entiende la lógica básica de prompts y Skills.
- Construyó una Skill para búsqueda/cotización de repuestos.
- Construyó y corrigió una Skill de banners.
- La Skill de banners necesitó una sesión extensa de estabilización antes de quedar usable.
- Se definieron reglas visuales más claras para banners: producto protagonista, texto más formal y recto, logos en segundo plano, jerarquía visual y adaptación según tipo de pieza/promoción.
- Se incorporó la regla de revisar qué entendió la IA antes de guardar cambios importantes en una Skill.
- Se introdujo el concepto de loop como revisión/corrección antes de entregar un resultado.
- Se identificó la programación de banners como próximo caso concreto de automatización.
- Se confirmó que Rodrigo necesita clases directas, prácticas y con bajo costo de preparación entre sesiones.

## Estado de la Skill de banners

**Estado:** funcional y recientemente estabilizada; pendiente de validación independiente antes de automatizar.

Antes de programarla debe comprobarse que:

- Rodrigo pueda usarla solo;
- mantenga las reglas visuales sin reconstruirlas;
- consulte correctamente producto, categoría, marca y stock;
- sepa detenerse cuando falte información;
- produzca resultados aceptables en varios casos reales.

## Próximo bloque de trabajo

### Convertir banners en un proceso programable

1. validar nuevamente la Skill;
2. separar información fija y variable;
3. diseñar la fuente de datos;
4. definir validaciones previas, incluido stock;
5. construir el proceso y sus loops de corrección;
6. definir aprobación humana y recordatorios;
7. definir programación local y recuperación si la computadora está apagada;
8. probar casos normales y fallos;
9. programar solo cuando el proceso esté estable.

## Resultado esperado

Al finalizar, Rodrigo debe poder:

- usar Claude y ChatGPT como herramientas complementarias;
- organizar contexto y conocimiento de ALFERepuestos, DFR y FADIRE;
- acelerar búsquedas de repuestos y equivalencias;
- analizar clientes, ventas, stock, precios e importaciones;
- convertir tareas repetidas en Skills/procesos;
- distinguir una Skill funcional de un proceso realmente estable;
- definir qué automatizar y qué mantener con control humano;
- operar una primera versión de su secretaria interna.

## Módulos

1. Entorno y mapa del trabajo.
2. Primera tarea asistida: resolver sin perder control.
3. Memoria del negocio y conocimiento reutilizable.
4. Investigación técnica y búsqueda de repuestos.
5. Clientes, ventas y preparación de giras.
6. Precios, compras e importaciones.
7. Skills, procesos y automatizaciones.
8. Integración: secretaria interna.

> El orden es una referencia. Rodrigo ya adelantó contenidos de Skills y procesos a partir de necesidades reales; el seguimiento se registra por capacidad demostrada, no solo por número de clase.

## Métricas transversales

Medir cuando corresponda:

- tiempo antes vs. después;
- cantidad de pasos manuales;
- errores detectados;
- respuestas que requieren corrección;
- consultas resueltas;
- tareas reutilizadas;
- impacto comercial observable;
- nivel de dependencia de Rodrigo;
- cantidad de correcciones estructurales necesarias después de una clase;
- capacidad de usar lo construido sin acompañamiento en vivo.
