#!/usr/bin/env python3
"""Carga un payload genideia-crm/2 grande en partes, con crm_importar (idempotente).

Uso:  SUPABASE_ACCESS_TOKEN=... python3 -I cargar.py <payload.json> [--previa] [--modo completar|actualizar]
Corre desde una carpeta enlazada al proyecto del CRM (supabase link).
"""
import json, subprocess, sys, tempfile, os, collections, urllib.request, time

REF = 'fzrrbqqvteyuwbvfgvnx'
LIMITE_MB = 100   # freno de seguridad: el plan gratuito pasa a solo lectura cerca de 500 MB

def tam_mb():
    req = urllib.request.Request(f'https://api.supabase.com/v1/projects/{REF}/database/query', method='POST',
        data=json.dumps({'query': 'select pg_database_size(current_database())/1048576 mb, (select count(*) from crm_revision) rev'}).encode(),
        headers={'Authorization': 'Bearer ' + os.environ['SUPABASE_ACCESS_TOKEN'], 'Content-Type': 'application/json'})
    r = json.load(urllib.request.urlopen(req))[0]
    req2 = urllib.request.Request(f'https://api.supabase.com/v1/projects/{REF}/config/disk/util',
        headers={'Authorization': 'Bearer ' + os.environ['SUPABASE_ACCESS_TOKEN']})
    libre = json.load(urllib.request.urlopen(req2))['metrics']['fs_avail_bytes'] // 1048576
    return int(r['mb']), int(r['rev']), libre

ORDEN = ['empresas', 'tandas', 'fuentes', 'contactos', 'conversaciones', 'actividades', 'materiales', 'tareas', 'participaciones', 'ejecuciones', 'revision']
MAX = 150_000
args = sys.argv[1:]
src = args[0]
aplicar = '--previa' not in args
modo = args[args.index('--modo') + 1] if '--modo' in args else 'completar'
P = json.load(open(src))

def partes():
    for ent in ORDEN:
        lote, size = [], 0
        for fila in P.get(ent, []):
            s = len(json.dumps(fila, ensure_ascii=False))
            if lote and size + s > MAX:
                yield ent, lote; lote, size = [], 0
            lote.append(fila); size += s
        if lote: yield ent, lote

total = collections.defaultdict(lambda: collections.Counter())
fallidos, n = [], 0
for ent, lote in partes():
    n += 1
    if n > 1: time.sleep(8)   # deja que Postgres recicle su registro entre partes
    body = json.dumps({ent: lote}, ensure_ascii=False)
    assert '$crmpl$' not in body
    sql = ("begin;\nselect set_config('request.jwt.claims','{\"role\":\"service_role\"}',true);\n"
           f"select crm_importar($crmpl${body}$crmpl$::jsonb, {str(aplicar).lower()}, '{modo}', '{os.path.basename(src)} · parte {n} · {ent}')::text as r;\ncommit;\n")
    with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False) as f:
        f.write(sql); path = f.name
    out = subprocess.run(['supabase', 'db', 'query', '--linked', '-f', path, '-o', 'json'], capture_output=True, text=True)
    os.unlink(path)
    try:
        r = json.loads(json.loads(out.stdout)['rows'][0]['r'])
    except Exception:
        print('ERROR en parte', n, ent, out.stderr[-800:], out.stdout[-800:]); sys.exit(1)
    for e, c in r['entidades'].items():
        total[e].update({k: v for k, v in c.items()})
    fallidos += r.get('fallidos', [])
    mb, rv, libre = tam_mb()
    print(f'parte {n:>2} {ent:<15} {len(lote):>5} filas · base {mb} MB · disco libre {libre} MB · revisión {rv} ·', {k: v for k, v in r['entidades'][ent].items() if v})
    if mb > LIMITE_MB or rv > 5000 or libre < 500:
        print('FRENO: la base pasó el límite de seguridad. Se detiene la carga.'); sys.exit(2)

print('\nRESUMEN', 'aplicado' if aplicar else 'vista previa')
for e in ORDEN:
    print(f'  {e:<15}', dict(total[e]))
if fallidos:
    print('FALLIDOS', len(fallidos)); [print('  ', x) for x in fallidos[:30]]
