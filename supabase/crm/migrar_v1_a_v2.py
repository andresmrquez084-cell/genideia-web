#!/usr/bin/env python3
"""Convierte el respaldo del CRM v1 (crm_companies + crm_interactions) al formato de importación v2.

Uso:  python3 -I migrar_v1_a_v2.py <companies.json> <interactions.json> <salida.json>

Reglas (no se inventa nada):
- Cada ficha vieja es una empresa con clave = su id viejo. Las notas completas van a notas_originales.
- Cada bloque [AIRTABLE · base / tabla · recXXX] es una fuente con su texto exacto.
- Fechas: fecha_hecho solo si el registro trae la hora real del hecho; si no, queda sin verificar.
  fecha_reporte = alta en Airtable; importado_en = alta en el CRM.
- Rol en la decisión, responsable y clasificación de respuesta solo si están escritos en el origen.
- Lo ambiguo va a revisión: nunca se fusiona ni se vincula por parecido.
"""
import json, re, sys, unicodedata, collections, datetime

C = json.load(open(sys.argv[1]))
E = json.load(open(sys.argv[2]))
OUT = sys.argv[3]

ARCHIVO = 'airtable-archivo-administrativo'
BLOCK = re.compile(r'^\[AIRTABLE · (.+?) / (.+?) · (rec\w+)\]\s*$', re.M)
FIELD = re.compile(r'^([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñÑ ()/_.#-]{1,40}): ?(.*)$')
EMAIL = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+')
GMAIL = re.compile(r'\b(1[0-9a-f]{15})\b')

def norm(s):
    s = unicodedata.normalize('NFD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()

def clean(v):
    v = (v or '').strip()
    if not v or norm(v) in ('pendiente de verificar', 'sin dato', 'n a', 'na', '-', 'sin verificar'):
        return None
    return v

def iso(v):
    """Devuelve ISO si v es una fecha-hora real (con hora), si no None."""
    if not v: return None
    m = re.search(r'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)', v)
    return m.group(1) if m else None

def parse_fields(text):
    f, last = {}, None
    for line in text.split('\n'):
        m = FIELD.match(line)
        if m and not line.startswith('http'):
            k = m.group(1).strip()
            if k in f:  # campo repetido: se conserva todo
                k2 = k; n = 2
                while k2 in f: k2 = f'{k} ({n})'; n += 1
                k = k2
            f[k] = m.group(2).strip(); last = k
        elif last is not None:
            f[last] = (f[last] + '\n' + line).strip()
    return f

def split_blocks(text):
    """[(cabecera, None)] + [(texto_bloque, (base, tabla, rec))]"""
    out, pos, head = [], 0, None
    ms = list(BLOCK.finditer(text or ''))
    head = (text or '')[:ms[0].start()] if ms else (text or '')
    for i, m in enumerate(ms):
        end = ms[i + 1].start() if i + 1 < len(ms) else len(text)
        out.append((text[m.start():end].strip('\n'), (m.group(1), m.group(2), m.group(3))))
    return head.strip('\n'), out

def wa(v):
    v = clean(v)
    if not v: return None
    if v.startswith('{'):
        try: return json.loads(v).get('url')
        except Exception: return v
    return v

# ---------------------------------------------------------------- recolección de bloques
blocks = {}          # rec -> dict
rec_empresa = {}     # rec de tabla Empresas/Leads -> id de ficha
cards = {r['id']: r['data'] for r in C}

def add_block(text, meta, card_id, legacy=None):
    base, tabla, rec = meta
    b = blocks.get(rec)
    if not b:
        b = blocks[rec] = {'rec': rec, 'base': base, 'tabla': tabla, 'text': text, 'f': parse_fields(text),
                           'cards': [], 'legacy': []}
    if card_id and card_id not in b['cards']: b['cards'].append(card_id)
    if legacy and legacy not in b['legacy']: b['legacy'].append(legacy)
    if len(text) > len(b['text']): b['text'] = text; b['f'] = parse_fields(text)
    return b

heads = {}
for cid, d in cards.items():
    head, bl = split_blocks(d.get('notes', ''))
    heads[cid] = head
    for text, meta in bl:
        add_block(text, meta, cid)
        if meta[1] in ('Empresas', 'Leads'):
            rec_empresa.setdefault(meta[2], cid)

inter_blocks = collections.defaultdict(list)   # id interacción -> [rec]
for e in E:
    d = e['data']
    _, bl = split_blocks(d['text'])
    for text, meta in bl:
        add_block(text, meta, d['companyId'] if d['companyId'] != ARCHIVO else None, e['id'])
        inter_blocks[e['id']].append(meta[2])

# ---------------------------------------------------------------- salida
P = {k: [] for k in ['empresas', 'tandas', 'fuentes', 'contactos', 'conversaciones', 'actividades', 'materiales', 'tareas', 'participaciones', 'ejecuciones', 'revision']}
acts = {}            # clave -> actividad
legacy_hecho = collections.defaultdict(list)   # id interacción vieja -> destinos
contacts = {}        # clave -> contacto
tandas = {}
review = {}

def rev(clave, tipo, entidad, ent_clave, detalle, rel=None, datos=None):
    review[clave] = {'clave': clave, 'tipo': tipo, 'entidad': entidad, 'entidad_clave': ent_clave,
                     'relacionada_clave': rel, 'detalle': detalle, 'datos': datos or {}}

def card_of_rec(rec):
    return rec_empresa.get(rec)

def put_act(a, legacy=()):
    k = a['clave']
    if k in acts:
        old = acts[k]
        for x, v in a.items():
            if v not in (None, '', [], {}) and old.get(x) in (None, '', [], {}): old[x] = v
        old['legacy_ids'] = sorted(set(old.get('legacy_ids', []) + list(legacy)))
    else:
        a['legacy_ids'] = sorted(set(a.get('legacy_ids', []) + list(legacy)))
        acts[k] = a
    for l in legacy: legacy_hecho[l].append('actividad ' + k)
    return acts[k]

def contact_for(empresa, nombre=None, email=None, cargo=None, fuente=None, nivel=None, old_id=None):
    email = (email or '').lower() or None
    nombre = clean(nombre)
    if old_id: k = 'crm1c:' + old_id
    elif email: k = f'{empresa}:{email}'
    elif nombre: k = f'{empresa}:{norm(nombre)}'
    else: return None
    # si ya existe un contacto de la misma empresa con ese email o nombre, se usa ese
    for c in contacts.values():
        if c['empresa'] == empresa and ((email and c.get('email') == email) or (nombre and c.get('nombre') and norm(c['nombre']) == norm(nombre) and not (email and c.get('email') and c['email'] != email))):
            for x, v in (('email', email), ('cargo', clean(cargo)), ('fuentes_verificacion', fuente), ('nivel_verificacion', nivel), ('nombre', nombre)):
                if v and not c.get(x): c[x] = v
            return c['clave']
    contacts[k] = {'clave': k, 'empresa': empresa, 'nombre': nombre, 'email': email, 'cargo': clean(cargo),
                   'fuentes_verificacion': fuente, 'nivel_verificacion': nivel, 'datos_extra': {}}
    return k

def tanda_for(nombre, canal='Email', responsable=None, fecha=None):
    if not nombre: return None
    k = 'tanda:' + norm(nombre).replace(' ', '-')
    if k not in tandas:
        tandas[k] = {'clave': k, 'nombre': nombre, 'canal': canal, 'responsable': responsable, 'fecha': fecha,
                     'distribucion': {}, 'variantes': [], 'notas': 'Reconstruida desde los registros importados.'}
    return k

CONTACTADO = {'contactado', 'esperando respuesta', 'no respondio', 'apertura enviada', 'enviado sin error detectado',
              'rebotado', 'error de canal', 'tu turno', 'respondio'}
TOCA = {'tu turno', 'respondio'}

# ---------------------------------------------------------------- empresas y fuentes
empresa_estado = {}
for cid, d in cards.items():
    if cid == ARCHIVO: continue
    head = heads[cid]
    recs = [b for b in blocks.values() if cid in b['cards'] and b['tabla'] in ('Empresas', 'Leads')]
    f = {}
    for b in recs:                       # primer valor no vacío de cada campo
        for k, v in b['f'].items():
            if clean(v) and k not in f: f[k] = v
    hf = parse_fields(head)
    estados = [norm(b['f'].get('Estado', '')) for b in recs if b['f'].get('Estado')]
    empresa_estado[cid] = estados
    web = clean(d.get('web')) or clean(f.get('Web'))
    if web and norm(web).startswith('confirmado sin web'): web = None
    m_resp = re.search(r'responsable ([A-ZÁÉÍÓÚ][\wáéíóú]+)', head)
    pais = clean(f.get('País')) or None
    zona = clean(f.get('Zona horaria'))
    if not pais or not zona:
        m = re.search(r'País: ([^.\n]+)\.', head); pais = pais or (m and clean(m.group(1)))
        m = re.search(r'Zona IANA registrada: ([^.\n]+)\.', head); zona = zona or (m and clean(m.group(1)))
    ciudad = clean(d.get('city')) or clean(f.get('Ciudad'))
    if not ciudad:
        m = re.search(r'Ciudad: ([^.\n]+)\.', head); ciudad = m and clean(m.group(1))
    creados = sorted(x for x in (iso(b['f'].get('Creado en Airtable')) for b in recs) if x)
    contacto_previo = any(e in CONTACTADO for e in estados) or d.get('stage') not in ('0', None)
    v1 = {k: d.get(k) for k in ('stage', 'maxStage', 'value', 'pauseDate', 'next', 'history', 'updatedAt', 'createdAt', 'source', 'segment')}
    extra = {'crm_v1': v1, 'contacto_previo': 'si' if contacto_previo else 'no'}
    for k in ('Estado', 'Rating', 'Reseñas', 'Google Maps', 'Tipo de número', 'Web verificada', 'Grado', 'Canal', 'Canal preferido',
              'Último contacto', 'Último toque', 'Próximo toque', 'Próxima revisión', 'Toques', 'Señal', 'Fuente original', 'Fuente de evidencia'):
        if clean(f.get(k)): extra[k] = f[k]
    emp = {
        'clave': cid, 'nombre': d.get('name') or 'Sin nombre',
        'rubro': clean(d.get('segment')) or clean(f.get('Sector')) or clean(f.get('Categoría')) or clean(f.get('Nicho')),
        'pais': pais, 'ciudad': ciudad, 'zona_horaria': zona, 'direccion': clean(f.get('Dirección')), 'web': web,
        'telefono': clean(d.get('phone')) or clean(f.get('Teléfono')), 'whatsapp': wa(f.get('WhatsApp')),
        'redes': {'instagram': f['Instagram']} if clean(f.get('Instagram')) else {},
        'origen': d.get('source'), 'responsable': m_resp.group(1) if m_resp else None,
        'notas_originales': d.get('notes') or None,
        'creado_origen': creados[0] if creados else None,
        'importado_en': d.get('createdAt'),
        'datos_extra': extra,
    }
    if 'no contactar' in estados:
        b = next(b for b in recs if norm(b['f'].get('Estado', '')) == 'no contactar')
        emp.update(no_contactar=True, no_contactar_motivo='Marcado "No contactar" en Airtable', no_contactar_evidencia=b['f'].get('URL'))
    if 'error de canal' in estados:
        b = next(b for b in recs if norm(b['f'].get('Estado', '')) == 'error de canal')
        emp.update(error_canal=True, error_canal_motivo='Marcado "Error de canal" en Airtable' + (': ' + b['f']['Canal'] if clean(b['f'].get('Canal')) else ''),
                   error_canal_evidencia=b['f'].get('URL'))
    P['empresas'].append(emp)
    # fuente: la ficha del CRM viejo
    P['fuentes'].append({'clave': 'crm_v1:' + cid, 'empresa': cid, 'sistema': 'crm_v1', 'base': d.get('source'), 'registro': cid,
                         'creado_origen': d.get('createdAt'), 'importado_en': d.get('createdAt'),
                         'campos': {k: v for k, v in d.items() if k not in ('notes',)}, 'texto_original': head or None})
    # fichas que agrupan muchos registros con nombres distintos
    nombres = {norm(b['f'].get('Empresa', '')) for b in recs if b['f'].get('Empresa')}
    if len(recs) > 3 and len(nombres) > 1:
        rev('agrupa:' + cid, 'verificar_dato', 'empresas', cid,
            f'Esta ficha agrupa {len(recs)} registros de Airtable con {len(nombres)} nombres distintos. Confirmar que son la misma empresa (no se separó automáticamente).')

for b in blocks.values():
    cid = b['cards'][0] if b['cards'] else None
    if cid == ARCHIVO: cid = None
    if b['tabla'] == 'Ejecuciones': continue
    P['fuentes'].append({'clave': 'airtable:' + b['rec'], 'empresa': cid, 'sistema': 'airtable', 'base': b['base'], 'tabla': b['tabla'],
                         'registro': b['rec'], 'url': b['f'].get('URL'), 'creado_origen': iso(b['f'].get('Creado en Airtable')),
                         'importado_en': iso(b['f'].get('Importado')), 'campos': b['f'], 'texto_original': b['text']})

empresa_ids = {e['clave'] for e in P['empresas']}

# ---------------------------------------------------------------- contactos del CRM viejo
for cid, d in cards.items():
    if cid not in empresa_ids: continue
    for k in d.get('contacts') or []:
        c = contact_for(cid, k.get('name'), None, k.get('title'), old_id=k.get('id'))
        if c and k.get('role'):
            contacts[c]['datos_extra']['rol_crm_v1'] = k['role']   # el CRM viejo lo asumió; no está verificado
        if c and clean(k.get('phone')): contacts[c]['telefono'] = k['phone']

def find_card_for_block(b):
    cid = b['cards'][0] if b['cards'] else None
    if not cid:
        idemp = b['f'].get('ID empresa') or b['f'].get('ID empresa CRM')
        cid = card_of_rec(idemp) if idemp else None
    return cid if cid in empresa_ids else None

name_index = collections.defaultdict(list)
for e in P['empresas']: name_index[norm(e['nombre'])].append(e['clave'])

# ---------------------------------------------------------------- Seguimiento Email → envíos y respuestas
send_by_gmail = {}
for b in [b for b in blocks.values() if b['tabla'] == 'Seguimiento Email']:
    f = b['f']; cid = find_card_for_block(b)
    if not cid:
        rev('sinempresa:' + b['rec'], 'sin_empresa', 'fuentes', 'airtable:' + b['rec'], 'Seguimiento de email sin empresa identificable.'); continue
    gid = (re.search(r'gmail:([0-9a-f]+)', f.get('Registro', '')) or [None, None])[1] or (GMAIL.search(f.get('Gmail ID envío', '')) or [None])[0]
    em = (EMAIL.search(f.get('Email', '')) or [None])[0]
    cont = contact_for(cid, f.get('Contacto'), em, None, fuente=f.get('Fuentes'))
    tk = tanda_for(clean(f.get('Tanda')))
    estado = norm(f.get('Estado', ''))
    st = {'enviado sin error detectado': 'sin_error_al_corte', 'rebotado': 'rebotado', 'respondio': 'respuesta_humana'}.get(estado)
    k = 'gmail:' + gid if gid else 'airtable:' + b['rec'] + ':envio'
    fh = iso(f.get('Enviado UTC'))
    a = put_act({'clave': k, 'empresa': cid, 'contacto': cont, 'tanda': tk, 'fuente': 'airtable:' + b['rec'], 'tipo': 'mensaje', 'direccion': 'saliente',
                 'canal': 'Email', 'fecha_hecho': fh, 'fecha_precision': 'exacta' if fh else 'sin_verificar',
                 'fecha_reporte': iso(f.get('Creado en Airtable')), 'importado_en': iso(f.get('Importado')), 'asunto': clean(f.get('Asunto')),
                 'texto': clean(f.get('Texto enviado')), 'estado_envio': st, 'variante': clean(f.get('Variante')), 'message_id': gid,
                 'evidencia': f.get('URL'), 'datos_extra': {'estado_airtable': f.get('Estado'), 'tipo_respuesta_airtable': f.get('Tipo de respuesta'),
                 'nicho': f.get('Nicho'), 'hora_local': f.get('Fecha y hora envío local')}}, b['legacy'])
    if gid: send_by_gmail[gid] = k
    # ejemplos de referencia incluidos en el envío
    pres = f.get('Presentación con los detalles', '')
    for line in [l for l in b['text'].split('\n')]:
        m = re.match(r'^([^:\n]{3,60}): (https?://\S+)$', line.strip())
        if m and m.group(1) not in ('URL', 'Fuentes', 'Fuente', 'Gmail') and pres:
            P['materiales'].append({'clave': f'{k}:mat:{norm(m.group(1)).replace(" ", "-")}', 'empresa': cid, 'contacto': cont, 'actividad': k,
                                    'tipo': 'ejemplo_referencia', 'titulo': m.group(1), 'url': m.group(2), 'enviado_en': fh})
    # respuesta registrada
    fr = iso(f.get('Primera respuesta UTC'))
    if fr or estado == 'respondio':
        gr = (GMAIL.search(f.get('Gmail ID respuesta', '')) or [None])[0]
        tr = norm(f.get('Tipo de respuesta', ''))
        cl = {'cordial sin compromiso': 'cordial_sin_compromiso', 'interes concreto': 'interes_concreto', 'negativa': 'negativa_baja',
              'baja': 'negativa_baja', 'derivacion': 'derivacion'}.get(tr)
        put_act({'clave': 'gmail:' + gr if gr else 'airtable:' + b['rec'] + ':respuesta1', 'empresa': cid, 'contacto': cont, 'responde_a': k,
                 'fuente': 'airtable:' + b['rec'], 'tipo': 'respuesta', 'direccion': 'entrante', 'canal': 'Email', 'fecha_hecho': fr,
                 'fecha_precision': 'exacta' if fr else 'sin_verificar', 'fecha_reporte': iso(f.get('Creado en Airtable')),
                 'importado_en': iso(f.get('Importado')), 'texto': clean(f.get('Resumen respuesta')), 'es_resumen': True,
                 'estado_envio': 'respuesta_humana', 'clasificacion': cl, 'primera_respuesta': True, 'message_id': gr,
                 'evidencia': f.get('URL')}, b['legacy'])

# ---------------------------------------------------------------- importación histórica de la tanda por email (texto en la interacción)
for e in E:
    d = e['data']; t = d['text']
    if not t.startswith('IMPORTACIÓN HISTÓRICA'): continue
    cid = d['companyId']
    gid = (re.search(r'Gmail ID envío: ([0-9a-f]+)', t) or [None, None])[1]
    m = re.search(r'Persona publicada: ([^.\n]+)\. Cargo: ([^.\n]+)\.', t)
    em = (re.search(r'Email: (\S+?)\.? Nivel', t) or [None, None])[1]
    nivel = (re.search(r'Nivel de verificación original: (\w+)', t) or [None, None])[1]
    fuente = (re.search(r'Fuente persona/cargo/email: (.+?)\. Fecha consulta', t) or [None, None])[1]
    cont = contact_for(cid, m and m.group(1), em, m and m.group(2), fuente=fuente, nivel=nivel)
    mt = re.search(r'tanda (\d{1,2}:\d{2}) · (\d{2})/(\d{2})/(\d{4})', t)
    tk = tanda_for(f'{mt.group(4)}-{mt.group(3)}-{mt.group(2)} {mt.group(1)}' if mt else None, 'Email', 'Andrés',
                   f'{mt.group(4)}-{mt.group(3)}-{mt.group(2)}' if mt else None)
    fh = iso((re.search(r'Enviado UTC Gmail: (\S+)', t) or [None, ''])[1])
    reemplaza = (re.search(r'Reemplaza: ([^\n]+)', t) or [None, None])[1]
    html = t.split('TEXTO HTML EXACTO ENVIADO:', 1)[1].strip() if 'TEXTO HTML EXACTO ENVIADO:' in t else None
    k = 'gmail:' + gid if gid else 'crm1i:' + e['id']
    put_act({'clave': k, 'empresa': cid, 'contacto': cont, 'tanda': tk, 'fuente': 'crm_v1:' + cid, 'tipo': 'mensaje', 'direccion': 'saliente',
             'canal': 'Email', 'fecha_hecho': fh, 'fecha_precision': 'exacta' if fh else 'sin_verificar', 'fecha_reporte': d.get('at'),
             'importado_en': cards.get(cid, {}).get('createdAt'), 'asunto': (re.search(r'Asunto: (.+?)\. Variante', t) or [None, None])[1],
             'texto': html, 'estado_envio': 'sin_error_al_corte' if 'Enviado sin error detectado' in t else ('envio_confirmado' if gid else None),
             'variante': (re.search(r'Variante: ([\w.-]+?)\.?(?:\s|$)', t) or [None, None])[1], 'message_id': gid, 'responsable': 'Andrés',
             'es_reposicion': bool(reemplaza), 'reemplaza': reemplaza,
             'evidencia': (re.search(r'Enlace: (\S+?)\.?(?:\s|$)', t) or [None, None])[1],
             'datos_extra': {'cabecera': t.split('TEXTO HTML EXACTO ENVIADO:')[0].strip()}}, [e['id']])
    if gid: send_by_gmail[gid] = k
    if d.get('material') == 'propuesta':
        rev('material:' + e['id'], 'verificar_dato', 'actividades', k,
            'En el CRM viejo este envío figuraba como "Propuesta o precio", pero el texto es un primer mensaje. Se registró como mensaje.', datos={'empresa': cid})

# ---------------------------------------------------------------- rebotes escritos en las notas de la tanda
for cid in empresa_ids:
    for line in heads.get(cid, '').split('\n'):
        if not line.startswith('REBOTE'): continue
        gid = (re.search(r'gmail:([0-9a-f]+):bounce', line) or [None, None])[1]
        orig = (re.search(r'Gmail ([0-9a-f]{16})', line) or [None, None])[1]
        k = f'gmail:{gid}:bounce' if gid else f'{cid}:rebote:{norm(line)[:40].replace(" ", "-")}'
        md = re.search(r'REBOTE (\d{2})/(\d{2})/(\d{4})', line)
        put_act({'clave': k, 'empresa': cid, 'tipo': 'rebote', 'direccion': 'entrante', 'canal': 'Email',
                 'fecha_hecho': f'{md.group(3)}-{md.group(2)}-{md.group(1)}T12:00:00Z' if md else None,
                 'fecha_precision': 'dia' if md else 'sin_verificar', 'texto': line, 'estado_envio': 'rebotado',
                 'responde_a': send_by_gmail.get(orig) if orig else None, 'evidencia': 'Notas de la ficha (CRM v1)', 'fuente': 'crm_v1:' + cid})

# ---------------------------------------------------------------- Eventos de Airtable
for b in [b for b in blocks.values() if b['tabla'] == 'Eventos']:
    f = b['f']; ev = f.get('Evento', ''); tipo = norm(f.get('Tipo', ''))
    clave_id = f.get('Clave de idempotencia', '')
    gid = (re.search(r'gmail:([0-9a-f]+)', clave_id) or [None, None])[1]
    cid = find_card_for_block(b)
    fh = iso(f.get('Fecha'))
    admin = ev.startswith(('Ejecución', 'Cierre diario'))
    if not cid and not admin:
        # vincular solo si el nombre del evento coincide exacto con UNA empresa
        nm = re.split(r' — | - ', ev)
        cands = sorted({c for part in nm[1:] for c in name_index.get(norm(re.sub(r'\(.*?\)', '', part)), [])})
        if len(cands) == 1:
            cid = cands[0]
            rev('vinculo:' + b['rec'], 'verificar_dato', 'actividades', 'airtable:' + b['rec'],
                f'Evento sin empresa en Airtable; se vinculó a la única empresa con ese nombre exacto. Confirmar.', rel=cid)
    if admin or not cid:
        P['ejecuciones'].append({'clave': 'airtable:' + b['rec'], 'tipo': 'error' if 'bloqueado' in ev else 'otro', 'titulo': ev, 'fecha': fh,
                                 'detalle': f.get('Detalle'), 'texto_original': b['text'], 'fuente_url': f.get('URL'), 'legacy_ids': b['legacy']})
        for l in b['legacy']: legacy_hecho[l].append('ejecución airtable:' + b['rec'])
        if not admin:
            rev('sinempresa:' + b['rec'], 'sin_empresa', 'ejecuciones', 'airtable:' + b['rec'],
                'Registro de un intercambio con un prospecto sin empresa identificable. Quedó en el espacio administrativo; asignarlo si corresponde.', datos={'evento': ev})
        continue
    if tipo == 'error' or 'rebote' in norm(ev):
        orig = send_by_gmail.get(gid) if gid else None
        k = f'gmail:{gid}:bounce' if gid else 'airtable:' + b['rec']
        put_act({'clave': k, 'empresa': cid, 'fuente': 'airtable:' + b['rec'], 'tipo': 'rebote', 'direccion': 'entrante', 'canal': 'Email',
                 'fecha_hecho': fh, 'fecha_precision': 'exacta' if fh else 'sin_verificar', 'fecha_reporte': iso(f.get('Creado en Airtable')),
                 'importado_en': iso(f.get('Importado')), 'texto': f.get('Detalle'), 'estado_envio': 'rebotado', 'responde_a': orig,
                 'evidencia': f.get('URL'), 'datos_extra': {'evento': ev, 'excluir': f.get('Excluir dirección')}}, b['legacy'])
        # el email queda marcado con error de canal (la oportunidad NO pasa a perdida)
        bad = (EMAIL.search(f.get('Detalle', '') + ' ' + f.get('Excluir dirección', '')) or [None])[0]
        if bad:
            ck = contact_for(cid, None, bad)
            contacts[ck].update(error_canal=True, error_canal_motivo='Rebote: ' + (f.get('Detalle') or '')[:140], error_canal_fecha=fh, error_canal_evidencia=f.get('URL'))
        if orig: acts[orig]['estado_envio'] = 'rebotado'
        continue
    if tipo == 'apertura enviada' and gid and gid in send_by_gmail:
        a = put_act({'clave': send_by_gmail[gid]}, b['legacy'])          # mismo envío, otra evidencia
        a.setdefault('datos_extra', {})['evento_airtable'] = f.get('URL')
        if 'reposicion' in norm(ev): a['es_reposicion'] = True
        continue
    canal = 'WhatsApp' if re.search(r'whatsapp|tramo|agente|\+598', ev + f.get('Detalle', ''), re.I) else 'Email'
    if tipo == 'respuesta humana':
        put_act({'clave': 'airtable:' + b['rec'], 'empresa': cid, 'fuente': 'airtable:' + b['rec'], 'tipo': 'respuesta', 'direccion': 'entrante',
                 'canal': canal, 'fecha_hecho': fh, 'fecha_precision': 'exacta' if fh else 'sin_verificar', 'fecha_reporte': iso(f.get('Creado en Airtable')),
                 'importado_en': iso(f.get('Importado')), 'texto': f.get('Detalle'), 'estado_envio': 'respuesta_humana' if canal == 'Email' else None,
                 'evidencia': f.get('URL'), 'datos_extra': {'evento': ev}}, b['legacy'])
    else:
        es_mat = 'ejemplos' in norm(ev)
        k = 'airtable:' + b['rec']
        put_act({'clave': k, 'empresa': cid, 'fuente': 'airtable:' + b['rec'], 'tipo': 'material' if es_mat else 'mensaje', 'direccion': 'saliente',
                 'canal': canal, 'fecha_hecho': fh, 'fecha_precision': 'exacta' if fh else 'sin_verificar', 'fecha_reporte': iso(f.get('Creado en Airtable')),
                 'importado_en': iso(f.get('Importado')), 'asunto': ev, 'texto': f.get('Detalle'), 'evidencia': f.get('URL'),
                 'es_reposicion': 'reposicion' in norm(ev), 'datos_extra': {'evento': ev, 'tipo_airtable': f.get('Tipo')}}, b['legacy'])
        if es_mat:
            for m in re.finditer(r'(https?://\S+)', f.get('Detalle', '')):
                P['materiales'].append({'clave': f'{k}:mat:{len(P["materiales"])}', 'empresa': cid, 'actividad': k, 'tipo': 'ejemplo_referencia',
                                        'titulo': 'Ejemplo enviado', 'url': m.group(1).rstrip('.,)'), 'enviado_en': fh})

# ---------------------------------------------------------------- Ejecuciones (administrativo)
for b in [b for b in blocks.values() if b['tabla'] == 'Ejecuciones']:
    f = b['f']
    P['ejecuciones'].append({'clave': 'airtable:' + b['rec'], 'tipo': 'envio_lote' if f.get('Aperturas') or f.get('Revisados') else 'otro',
                             'titulo': f.get('Ejecución'), 'fecha': iso(f.get('Inicio')), 'detalle': f.get('Observaciones'),
                             'texto_original': b['text'], 'fuente_url': f.get('URL'), 'legacy_ids': b['legacy'],
                             'datos_extra': {k: f.get(k) for k in ('Estado', 'Aperturas', 'Respuestas', 'Revisados', 'Anterior') if f.get(k)}})
d = cards[ARCHIVO]
P['ejecuciones'].append({'clave': 'crm_v1:' + ARCHIVO, 'tipo': 'otro', 'titulo': d['name'], 'detalle': heads[ARCHIVO] or None,
                         'texto_original': d['notes'], 'datos_extra': {'origen': d.get('source')}})

# interacciones viejas que quedaron sin destino: se conservan como actividad sin desglosar
for e in E:
    if e['id'] in legacy_hecho: continue
    d = e['data']; cid = d['companyId']
    if cid not in empresa_ids:
        P['ejecuciones'].append({'clave': 'crm1i:' + e['id'], 'tipo': 'otro', 'titulo': 'Interacción del CRM viejo sin empresa', 'texto_original': d['text'], 'legacy_ids': [e['id']]})
        legacy_hecho[e['id']].append('ejecución'); continue
    put_act({'clave': 'crm1i:' + e['id'], 'empresa': cid, 'tipo': 'mensaje' if d['dir'] == 'out' else 'respuesta',
             'direccion': 'saliente' if d['dir'] == 'out' else 'entrante', 'canal': d.get('channel'), 'fecha_hecho': None,
             'fecha_precision': 'sin_verificar', 'fecha_reporte': d.get('at'), 'texto': d['text'], 'fuente': 'crm_v1:' + cid}, [e['id']])

# ---------------------------------------------------------------- conversaciones, tareas, tandas
by_emp = collections.defaultdict(list)
for a in acts.values(): by_emp[a['empresa']].append(a)
for e in P['empresas']:
    cid = e['clave']; d = cards[cid]; A = by_emp.get(cid, []); estados = empresa_estado.get(cid, [])
    if not A and e['datos_extra']['contacto_previo'] != 'si': continue
    hum = [a for a in A if a['tipo'] in ('respuesta', 'derivacion') and a['direccion'] == 'entrante']
    out = [a for a in A if a['direccion'] == 'saliente']
    canal = (out or A or [{}])[0].get('canal') or clean(e['datos_extra'].get('Canal preferido'))
    ev_ej = next((a for a in A if a['tipo'] == 'material'), None)
    if d.get('stage') == 'D':
        etapa, atencion, evid = 'perdido', 'cerrado', 'Descartado en el CRM viejo'
    elif hum or any(x in TOCA for x in estados) or ev_ej:
        etapa = 'conversacion_abierta'
        evid = 'Respuesta registrada' if hum else ('Evento: ' + ev_ej['asunto'] if ev_ej else 'Estado en Airtable: ' + ', '.join(estados))
        ult = sorted(A, key=lambda a: a.get('fecha_hecho') or '')[-1] if A else None
        atencion = 'nos_toca_responder' if (ult and ult['direccion'] == 'entrante' and ult['tipo'] != 'rebote') or (not A and any(x in TOCA for x in estados)) else 'esperando_prospecto'
    else:
        etapa, evid = 'contacto_iniciado', ('Envío registrado' if out else 'Estado en Airtable: ' + (', '.join(estados) or 'etapa ' + str(d.get('stage'))))
        atencion = 'esperando_prospecto'
    if d.get('stage') == 'P': atencion = 'pausado'
    if out and all(a.get('estado_envio') == 'rebotado' for a in out) and etapa == 'contacto_iniciado':
        atencion = None
        rev('rebote:' + cid, 'verificar_dato', 'empresas', cid, 'Todos los envíos rebotaron. Definir otro canal o cerrar (no se marcó como perdida).')
    nx = d.get('next') or {}
    if nx.get('date') and atencion == 'esperando_prospecto': atencion = 'seguimiento_programado'
    ks = sorted({a['contacto'] for a in A if a.get('contacto')})
    conv = {'clave': 'conv:' + cid, 'empresa': cid, 'canal': canal, 'etapa': etapa, 'atencion': atencion, 'etapa_evidencia': evid,
            'responsable': e.get('responsable'), 'valor': float(d['value']) if str(d.get('value') or '').replace('.', '', 1).isdigit() else None,
            'contactos': ks, 'datos_extra': {'etapa_crm_v1': d.get('stage')}}
    P['conversaciones'].append(conv)
    for a in A: a.setdefault('conversacion', conv['clave'])
    if nx.get('date') or nx.get('text'):
        P['tareas'].append({'clave': f'crm1t:{cid}:{nx.get("date") or "sinfecha"}', 'empresa': cid, 'conversacion': conv['clave'],
                            'accion': nx.get('text') or 'Seguimiento (sin detalle en el CRM viejo)', 'fecha': nx.get('date') or None,
                            'estado': 'pendiente', 'origen': 'CRM v1 · próximo paso'})
    if not A:
        pass  # la vista la muestra como "Actividad sin desglosar; consultar historial"

# participaciones por tanda
parts = collections.defaultdict(list)
for a in acts.values():
    if a.get('tanda') and a['tipo'] == 'mensaje' and a['direccion'] == 'saliente': parts[(a['tanda'], a['empresa'])].append(a)
for (tk, cid), L in parts.items():
    L.sort(key=lambda a: a.get('fecha_hecho') or '')
    for i, a in enumerate(L, 1):
        a['intento'] = i
        P['participaciones'].append({'clave': f'{tk}:{a["clave"]}', 'tanda': tk, 'empresa': cid, 'contacto': a.get('contacto'), 'actividad': a['clave'],
                                     'nicho': (a.get('datos_extra') or {}).get('nicho'), 'variante': a.get('variante'), 'intento': i,
                                     'es_reposicion': bool(a.get('es_reposicion')), 'reemplaza': a.get('reemplaza'), 'resultado': a.get('estado_envio')})
for tk, t in tandas.items():
    ps = [p for p in P['participaciones'] if p['tanda'] == tk]
    t['distribucion'] = dict(collections.Counter(p['nicho'] or 'Sin nicho' for p in ps))
    t['variantes'] = sorted({p['variante'] for p in ps if p['variante']})
    if not t.get('fecha'):
        fs = sorted(a['fecha_hecho'][:10] for a in acts.values() if a.get('tanda') == tk and a.get('fecha_hecho'))
        t['fecha'] = fs[0] if fs else None

for a in acts.values():
    if a.get('fecha_precision') == 'sin_verificar':
        rev('fecha:' + a['clave'], 'fecha_sin_verificar', 'actividades', a['clave'], 'La fecha real de esta actividad no está en el origen.', datos={'empresa': a['empresa']})
    if a.get('responde_a') and a['responde_a'] not in acts: a['responde_a'] = None

P['tandas'] = list(tandas.values())
P['contactos'] = list(contacts.values())
P['actividades'] = list(acts.values())
P['revision'] = list(review.values())
P['formato'] = 'genideia-crm/2'

faltan = [e['id'] for e in E if e['id'] not in legacy_hecho]
json.dump(P, open(OUT, 'w'), ensure_ascii=False)
print(json.dumps({k: len(v) for k, v in P.items() if isinstance(v, list)}, ensure_ascii=False))
print('interacciones viejas sin destino:', len(faltan), '· cubiertas:', len(legacy_hecho), 'de', len(E))
