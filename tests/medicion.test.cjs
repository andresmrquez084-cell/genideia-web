const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyze}=require('../public/crm/medicion.js');
const now=Date.parse('2026-11-23T20:00:00Z');
const empresas=[{id:'a',nombre:'Taller A',nicho:'Talleres'},{id:'b',nombre:'Restaurante B',nicho:'Restaurantes'}];
const out=(id,date,more={})=>({id,clave:id,empresa_id:'a',tipo:'mensaje',direccion:'saliente',canal:'Email',fecha_hecho:date,fecha_precision:'exacta',variante:'H1-v1',...more});
const reply=(id,date,more={})=>({id,clave:id,empresa_id:'a',tipo:'respuesta',direccion:'entrante',canal:'Email',fecha_hecho:date,fecha_precision:'exacta',...more});
const go=(acts,options={})=>analyze({empresas,actividades:acts},{now,hours:48,...options});
test('cuenta respuestas recientes y sin fecha en el total, sin inventar atribución',()=>{
 const m=go([out('o','2026-11-23T18:00:00Z'),reply('r',null,{fecha_precision:'sin_verificar',datos_extra:{reaccion:'acepta_material'}})]);
 assert.equal(m.rows[0].respondio,true);assert.equal(m.rows[0].reaccion,'acepta_material');assert.equal(m.versiones[0].observados,0);assert.equal(m.versiones[0].pendientes,1);assert.equal(m.sin_atribuir,1);
});
test('excluye rebotes, automáticas y avisos de demora de las respuestas humanas',()=>{
 const m=go([out('o','2026-11-19T10:00:00Z'),reply('b','2026-11-19T11:00:00Z',{tipo:'rebote'}),reply('auto','2026-11-19T11:00:00Z',{estado_envio:'respuesta_automatica'}),reply('delay','2026-11-19T11:00:00Z',{estado_envio:'demora_temporal'})]);
 assert.equal(m.total_respuestas,0);assert.equal(m.rows[0].sin_respuesta,true);assert.equal(m.versiones[0].respondieron,0);
});
test('varias respuestas a un mensaje cuentan como una exposición respondida',()=>{
 const m=go([out('o','2026-11-19T10:00:00Z'),reply('r1','2026-11-19T11:00:00Z'),reply('r2','2026-11-19T12:00:00Z')]);
 assert.equal(m.total_respuestas,2);assert.equal(m.versiones[0].respondieron,1);assert.equal(m.versiones[0].observados,1);
});
test('no atribuye respuesta anterior a otro mensaje ni de otro canal',()=>{
 const m=go([reply('old','2026-11-18T12:00:00Z'),out('o','2026-11-19T10:00:00Z'),reply('wa','2026-11-19T11:00:00Z',{canal:'WhatsApp'})]);
 assert.equal(m.rows[0].respondio,true);assert.equal(m.versiones[0].respondieron,0);assert.equal(m.sin_atribuir,2);
});
test('responder después de presentación se atribuye a esa fase',()=>{
 const m=go([out('o','2026-11-19T10:00:00Z'),reply('r1','2026-11-19T11:00:00Z'),out('p','2026-11-19T12:00:00Z',{tipo:'material',variante:'P-v1'}),reply('r2','2026-11-19T13:00:00Z')]);
 assert.equal(m.rows[0].posteriores.length,1);assert.equal(m.versiones.find(x=>x.fase==='Presentación').respondieron,1);assert.equal(m.versiones.find(x=>x.fase==='Primer contacto').respondieron,1);
});
test('material sin fecha y respuesta sin vínculo no implican devolución posterior',()=>{
 const m=go([out('p',null,{tipo:'material',fecha_precision:'sin_verificar'}),reply('r',null,{fecha_precision:'sin_verificar'})]);
 assert.equal(m.rows[0].posteriores.length,0);assert.equal(m.rows[0].fecha_posterior_pendiente,true);
});
test('vínculo explícito permite registrar devolución sin fabricar hora ni tasa',()=>{
 const m=go([out('p',null,{tipo:'material',fecha_precision:'sin_verificar'}),reply('r',null,{fecha_precision:'sin_verificar',responde_a:'p'})]);
 assert.equal(m.rows[0].posteriores.length,1);assert.equal(m.versiones[0].respondieron,0);
});
test('cohortes de 48h y 7d tienen denominadores maduros distintos',()=>{
 const a=[out('o','2026-11-19T10:00:00Z'),reply('r','2026-11-22T11:00:00Z')];
 assert.equal(go(a).versiones[0].observados,1);assert.equal(go(a).versiones[0].respondieron,0);assert.equal(go(a,{hours:168}).versiones[0].observados,0);
});
test('una respuesta por empresa aunque tenga varios mensajes; no inventa interés por proveedor actual',()=>{
 const m=go([out('o','2026-11-19T10:00:00Z'),out('o2','2026-11-19T12:00:00Z'),reply('r','2026-11-19T13:00:00Z',{datos_extra:{reaccion:'proveedor_actual'}})]);
 assert.equal(m.rows[0].reaccion,'proveedor_actual');assert.equal(m.nichos[0].respondieron,1);assert.equal(m.versiones[0].observados,1);assert.equal(m.versiones[0].respondieron,0);
});
test('no mezcla dos nichos que usan el mismo nombre de versión',()=>{
 const m=go([out('a','2026-11-19T10:00:00Z'),out('b','2026-11-19T10:00:00Z',{empresa_id:'b'})]);assert.equal(m.versiones.length,2);
});
test('separa por país incluso dentro del mismo nicho y versión',()=>{
 const m=analyze({empresas:[{id:'a',nicho:'Talleres',pais:'España'},{id:'b',nicho:'Talleres',pais:'Uruguay'}],actividades:[out('a','2026-11-19T10:00:00Z'),out('b','2026-11-19T10:00:00Z',{empresa_id:'b'})]},{now,hours:48});assert.equal(m.versiones.length,2);
});
test('una automática posterior al material no es devolución humana',()=>{
 const m=go([out('p','2026-11-19T10:00:00Z',{tipo:'material'}),reply('auto','2026-11-19T11:00:00Z',{estado_envio:'respuesta_automatica'})]);assert.equal(m.rows[0].posteriores.length,0);
});
