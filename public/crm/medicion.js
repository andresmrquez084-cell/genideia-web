/* Medición por empresa y por mensaje. Las fechas de carga nunca sustituyen fechas de contacto. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.GenideiaMedicion=factory()})(typeof window!=='undefined'?window:this,function(){
'use strict';
var REACCIONES={acepta_material:'Sí a recibir o revisar información',interes_concreto:'Interés comercial concreto',negativa:'No / negativa',baja:'Baja / no contactar',proveedor_actual:'Ya trabaja con otra empresa',cordial:'Cordial, sin compromiso',derivacion:'Derivación',sin_clasificar:'Respuesta sin clasificar'};
function extra(a){return a.datos_extra||{}}
function humana(a){return a.direccion==='entrante'&&['respuesta','mensaje','llamada','reunion','derivacion','baja'].indexOf(a.tipo)>=0&&['rebotado','respuesta_automatica','demora_temporal'].indexOf(a.estado_envio)<0}
function saliente(a){return a.direccion==='saliente'&&['mensaje','material','propuesta','seguimiento','llamada','reunion'].indexOf(a.tipo)>=0}
function tiempo(a){var t=Date.parse(a.fecha_hecho);return Number.isFinite(t)?t:null}
function exacta(a){return tiempo(a)!==null&&(!a.fecha_precision||a.fecha_precision==='exacta')}
function reaccion(a){var r=extra(a).reaccion;if(REACCIONES[r])return r;return {interes_concreto:'interes_concreto',solicita_info:'acepta_material',cordial_sin_compromiso:'cordial',sin_interes_definido:'cordial',negativa_baja:'negativa',derivacion:'derivacion'}[a.clasificacion]||(a.tipo==='baja'?'baja':'sin_clasificar')}
function material(a){return a.tipo==='material'||a.tipo==='propuesta'||extra(a).fase==='presentacion'}
function fase(a){return material(a)?'Presentación':a.tipo==='seguimiento'?'Seguimiento':'Primer contacto'}
function sameThread(a,b){return a.empresa_id===b.empresa_id&&(!a.conversacion_id||!b.conversacion_id||a.conversacion_id===b.conversacion_id)}
function analyze(data,options){
  var opt=options||{},now=opt.now||Date.now(),hours=Number(opt.hours||48),ms=hours*36e5;
  var E=data.empresas||[],A=data.actividades||[],M=data.materiales||[],catalog=data.versiones||[];
  var em={},am={},rows=[],sets={},responses=A.filter(humana),outs=A.filter(saliente);
  E.forEach(function(e){em[e.id]=e});A.forEach(function(a){am[a.id]=a});
  function bucket(id){if(!sets[id])sets[id]={empresa:em[id]||{id:id,nombre:'Empresa pendiente'},out:[],replies:[],materials:[]};return sets[id]}
  E.forEach(function(e){bucket(e.id)});outs.forEach(function(a){bucket(a.empresa_id).out.push(a)});responses.forEach(function(a){bucket(a.empresa_id).replies.push(a)});
  M.forEach(function(m){if(m.enviado_en||m.actividad_id||extra(m).envio_reportado)bucket(m.empresa_id).materials.push(m)});
  Object.keys(sets).forEach(function(id){var b=sets[id];b.out.filter(material).forEach(function(a){if(!b.materials.some(function(m){return m.actividad_id===a.id}))b.materials.push({id:'actividad:'+a.id,empresa_id:id,actividad_id:a.id,enviado_en:a.fecha_hecho,titulo:a.asunto||'Material enviado',datos_extra:extra(a)})});
    var last=b.replies.slice().sort(function(a,c){return (tiempo(c)||Date.parse(c.fecha_reporte)||Date.parse(c.creado_en)||0)-(tiempo(a)||Date.parse(a.fecha_reporte)||Date.parse(a.creado_en)||0)})[0];
    var post=b.replies.filter(function(r){return b.materials.some(function(m){if(m.respuesta_actividad_id===r.id)return true;if(r.responde_a&&r.responde_a===m.actividad_id)return true;if(extra(r).fase_respuesta==='despues_presentacion')return true;var a=am[m.actividad_id];return exacta(r)&&m.enviado_en&&Date.parse(m.enviado_en)<tiempo(r)&&(!a||sameThread(r,a))})});
    rows.push({id:id,empresa:b.empresa,nicho:b.empresa.nicho||b.empresa.rubro||'Sin nicho',contactada:b.out.length>0||b.replies.length>0,respuestas:b.replies,intentos:b.out.length,respondio:b.replies.length>0,reaccion:last?reaccion(last):null,materiales:b.materials,posteriores:post,fecha_posterior_pendiente:b.materials.length>0&&b.replies.some(function(r){return !exacta(r)})&&!post.length,sin_respuesta:b.out.length>0&&!b.replies.length,out:b.out});
  });
  // Una respuesta se atribuye solo al último envío anterior del mismo canal/conversación,
  // o al envío señalado explícitamente. Nunca se atribuye una respuesta antigua a un mensaje nuevo.
  var attributed={};responses.forEach(function(r){var target=null;
    if(r.responde_a&&am[r.responde_a]&&saliente(am[r.responde_a])&&sameThread(r,am[r.responde_a]))target=am[r.responde_a];
    else if(exacta(r)){var possible=outs.filter(function(o){return exacta(o)&&sameThread(r,o)&&r.canal===o.canal&&tiempo(o)<tiempo(r)}).sort(function(a,b){return tiempo(b)-tiempo(a)});target=possible[0]||null}
    if(target){if(!attributed[target.id])attributed[target.id]=[];attributed[target.id].push(r)}
  });
  var first={};outs.filter(function(a){return fase(a)==='Primer contacto'}).slice().sort(function(a,b){return (tiempo(a)||0)-(tiempo(b)||0)}).forEach(function(a){var k=a.empresa_id+'|'+a.canal;if(!first[k])first[k]=a.id});
  var versions={};function versionKey(a){var e=em[a.empresa_id]||{},d=extra(a);return [e.nicho||e.rubro||'Sin nicho',a.canal||'Sin canal',fase(a),a.variante||d.version_mensaje||'Sin versión',e.pais||'País sin verificar'].join('|')}
  outs.forEach(function(a){var k=versionKey(a),e=em[a.empresa_id]||{},d=extra(a);if(!versions[k])versions[k]={key:k,nicho:e.nicho||e.rubro||'Sin nicho',pais:e.pais||'País sin verificar',canal:a.canal||'Sin canal',fase:fase(a),version:a.variante||d.version_mensaje||'Sin versión',intentos:0,rebotes:0,observados:0,respondieron:0,pendientes:0,sin_fecha:0,reacciones:{},mensajes:[],empresas:new Set()};var v=versions[k];v.intentos++;v.empresas.add(a.empresa_id);
    var bounce=a.estado_envio==='rebotado'||A.some(function(x){return x.tipo==='rebote'&&(x.responde_a===a.id||extra(x).gmail_id_envio===a.message_id)});if(bounce)v.rebotes++;
    var rr=attributed[a.id]||[];v.mensajes.push({actividad:a,empresa:e,respuestas:rr,rebote:bounce});
    // Primer contacto: una exposición por empresa y canal; seguimientos y materiales tienen su propia fase.
    if(fase(a)==='Primer contacto'&&first[a.empresa_id+'|'+a.canal]!==a.id)return;
    if(!exacta(a)){v.sin_fecha++;return}if(tiempo(a)+ms>now){v.pendientes++;return}
    v.observados++;
    var within=rr.filter(function(r){return exacta(r)&&tiempo(r)>=tiempo(a)&&tiempo(r)<=tiempo(a)+ms});
    if(within.length){v.respondieron++;var cl=reaccion(within.slice().sort(function(a,b){return tiempo(a)-tiempo(b)})[0]);v.reacciones[cl]=(v.reacciones[cl]||0)+1}
  });
  // El catálogo conserva versiones aún sin enviar, sin crear resultados ficticios.
  catalog.forEach(function(c){var d=extra(c);if(d.tipo!=='version_mensaje')return;var matches=Object.keys(versions).filter(function(k){var v=versions[k];return v.nicho===d.nicho&&v.canal===d.canal&&v.fase===d.fase&&v.version===d.version});if(matches.length){matches.forEach(function(k){versions[k].catalogo=c});return}var k=[d.nicho,d.canal,d.fase,d.version,'Catálogo'].join('|');versions[k]={key:k,nicho:d.nicho,pais:'Catálogo · aún sin envíos',canal:d.canal,fase:d.fase,version:d.version,intentos:0,rebotes:0,observados:0,respondieron:0,pendientes:0,sin_fecha:0,reacciones:{},mensajes:[],empresas:new Set(),catalogo:c}});
  var vs=Object.keys(versions).map(function(k){var v=versions[k];v.empresas=v.empresas.size;return v});
  var n={};rows.forEach(function(r){if(!n[r.nicho])n[r.nicho]={nicho:r.nicho,empresas:0,contactadas:0,respondieron:0,sin_respuesta:0,materiales:0,posteriores:0,pendiente_fecha:0,reacciones:{},rows:[]};var x=n[r.nicho];x.empresas++;if(r.contactada)x.contactadas++;if(r.respondio)x.respondieron++;if(r.sin_respuesta)x.sin_respuesta++;if(r.materiales.length)x.materiales++;if(r.posteriores.length)x.posteriores++;if(r.fecha_posterior_pendiente)x.pendiente_fecha++;if(r.reaccion)x.reacciones[r.reaccion]=(x.reacciones[r.reaccion]||0)+1;x.rows.push(r)});
  return {rows:rows,nichos:Object.keys(n).map(function(k){return n[k]}),versiones:vs,actividades:A,hours:hours,total_respuestas:responses.length,automaticas:A.filter(function(a){return a.estado_envio==='respuesta_automatica'}).length,sin_atribuir:responses.filter(function(r){return !Object.keys(attributed).some(function(k){return attributed[k].indexOf(r)>=0})}).length};
}
return {analyze:analyze,humana:humana,saliente:saliente,reaccion:reaccion,material:material,fase:fase,REACCIONES:REACCIONES};
});
