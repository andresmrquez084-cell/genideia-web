// Prepara academy/data/public-plans.json antes del build.
// Los planes de alumnos NO viven en el repositorio. Orden de origen:
//   1. variable ACADEMY_PLANS_JSON (Secret en Cloudflare Pages / Vercel)
//   2. archivo local private/academy/public-plans.json (ignorado por git, sólo en tu máquina)
//   3. si no hay ninguno: lista vacía (las rutas de alumno devuelven 404; el build sigue)
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const target = 'academy/data/public-plans.json';
const local = 'private/academy/public-plans.json';
mkdirSync(dirname(target), { recursive: true });

let source = 'vacio';
if (process.env.ACADEMY_PLANS_JSON) {
  let parsed;
  try {
    parsed = JSON.parse(process.env.ACADEMY_PLANS_JSON);
  } catch {
    console.error('ACADEMY_PLANS_JSON no es JSON válido');
    process.exit(1);
  }
  writeFileSync(target, JSON.stringify(parsed));
  source = 'variable ACADEMY_PLANS_JSON';
} else if (existsSync(local)) {
  copyFileSync(local, target);
  source = local;
} else {
  writeFileSync(target, JSON.stringify({ version: 1, updatedAt: null, students: [] }));
}
console.log(`[academy] planes preparados desde: ${source}`);
