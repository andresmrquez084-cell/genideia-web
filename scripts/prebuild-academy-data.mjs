// Prepara academy/data/public-plans.json antes del build y valida la configuración de Academy.
// Los planes NO viven en el repositorio. Orden de origen:
//   1. variable ACADEMY_PLANS_JSON (Secret en Cloudflare Pages / Vercel)
//   2. archivo local private/academy/public-plans.json (ignorado por git, sólo en tu máquina)
//   3. ninguno: lista vacía.
//
// Producción = build del branch main (Cloudflare: CF_PAGES_BRANCH=main; Vercel: VERCEL_ENV=production),
// o ACADEMY_REQUIRE_PLANS=1. En producción el build FALLA si falta algo, para que Cloudflare/Vercel
// conserven el deployment anterior en vez de publicar una Academy sin planes o sin login.
// Nunca imprime valores de secretos ni contenido de planes.
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

const target = 'academy/data/public-plans.json';
const local = 'private/academy/public-plans.json';
mkdirSync(dirname(target), { recursive: true });

const production =
  process.env.CF_PAGES_BRANCH === 'main' || process.env.VERCEL_ENV === 'production' || process.env.ACADEMY_REQUIRE_PLANS === '1';
const problems = [];

// 1) Planes
let source = 'ninguna (lista vacía)';
if (process.env.ACADEMY_PLANS_JSON) {
  try {
    const parsed = JSON.parse(process.env.ACADEMY_PLANS_JSON);
    if (!parsed || !Array.isArray(parsed.students)) throw new Error('shape');
    writeFileSync(target, JSON.stringify(parsed));
    source = 'variable ACADEMY_PLANS_JSON';
  } catch {
    problems.push('ACADEMY_PLANS_JSON no es JSON válido con la forma {students:[…]}');
  }
} else if (existsSync(local)) {
  copyFileSync(local, target);
  source = 'archivo local private/';
} else {
  writeFileSync(target, JSON.stringify({ version: 1, updatedAt: null, students: [] }));
  problems.push('falta ACADEMY_PLANS_JSON (sin planes, las rutas de alumno quedarían vacías)');
}

// 2) Configuración de login (runtime). Se valida aquí sólo lo visible en build.
const secret = process.env.ACADEMY_SESSION_SECRET || '';
if (secret.length < 32) problems.push('falta ACADEMY_SESSION_SECRET (32+ caracteres)');
let users = null;
try {
  users = JSON.parse(process.env.ACADEMY_USERS_JSON || 'null');
} catch {
  users = null;
}
if (!users || typeof users !== 'object' || Array.isArray(users)) {
  problems.push('falta ACADEMY_USERS_JSON válido');
} else if (!Object.values(users).some((u) => u && u.role === 'admin' && u.disabled !== true)) {
  problems.push('ACADEMY_USERS_JSON no tiene ningún admin activo');
}

console.log(`[academy] modo ${production ? 'producción' : 'no producción'} · planes desde: ${source}`);
if (problems.length) {
  for (const p of problems) console.error(`[academy] ${production ? 'ERROR' : 'aviso'}: ${p}`);
  if (production) {
    console.error('[academy] build de producción cancelado. El deployment anterior sigue activo. Revisá docs/academy-acceso.md.');
    process.exit(1);
  }
}
