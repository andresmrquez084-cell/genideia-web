/* CRM GENIDEIA · prospección multicanal (27/11/2026).
   Pestañas Instagram, Reuniones y Comercial sobre las mismas tablas del CRM (migración 20261127100000).
   Reglas: nada se marca enviado por abrir un perfil o copiar un texto; una reunión no se marca realizada sola;
   las métricas cuentan empresas únicas a partir de actividades registradas, sin completar datos faltantes. */
window.GenideiaMulticanal=function(C){
'use strict';
var sb=C.sb,V=C.views,$=C.$,esc=C.esc,table=C.table,kpi=C.kpi,opts=C.opts,modal=C.modal,guardar=C.guardar,q=C.q,toast=C.toast,closeModal=C.closeModal,fdt=C.fdt,fd=C.fd;
var $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
var TZ='America/Montevideo';

/* ---------- catálogos ---------- */
var EMB=[['prospecto','Prospecto identificado','#8C96A8'],['primer_mensaje','Primer mensaje enviado','#9FB3FF'],['respuesta','Respuesta recibida','#38D6FF'],
  ['material','Material presentado','#5AC8FF'],['conversacion_comercial','Conversación comercial','#5AA9FF'],['reunion_agendada','Reunión agendada','#7FD1FF'],
  ['reunion_realizada','Reunión realizada','#4FB3FF'],['propuesta','Propuesta económica','#FFB84D'],['negociacion','Negociación','#B79CFF'],['ganado','Ganado','#4BE39A'],['perdido','Perdido','#FF6B7A']];
var EMBM={};EMB.forEach(function(x,i){EMBM[x[0]]={n:x[1],c:x[2],r:i}});
var CLS=[['interes_concreto','Positiva'],['solicita_info','Solicita información'],['cordial_sin_compromiso','Cordial sin compromiso'],['derivacion','Derivación a otro responsable'],['negativa_baja','Negativa'],['sin_interes_definido','Sin interés definido']];
var POS=['interes_concreto','solicita_info'];
var ASES=[['Andrés','Andrés'],['Agustín Alvez','Agustín Alvez']];
var CANAL=[['Instagram','Instagram'],['WhatsApp','WhatsApp'],['Email','Email'],['Llamada','Llamada'],['Otro','Otro']];
var REL=[['seguidor','Seguidor o contacto de la cuenta'],['negocio_investigado','Negocio investigado'],['otro','Otro origen comprobable']];
var REU=[['agendada','Agendada'],['realizada','Realizada'],['no_asistio','No asistió'],['reprogramada','Reprogramada'],['cancelada','Cancelada']];
var ZONAS=[['America/Montevideo','Uruguay'],['America/Argentina/Buenos_Aires','Argentina'],['America/Asuncion','Paraguay'],['America/Santiago','Chile'],['America/Lima','Perú'],['America/Bogota','Colombia'],['America/Mexico_City','México (centro)'],['America/Costa_Rica','Costa Rica'],['Europe/Madrid','España']];
var RANGOS=[['hoy','Hoy'],['ayer','Ayer'],['semana','Últimos 7 días'],['mes','Este mes'],['30d','Últimos 30 días'],['todo','Histórico']];
function lbl(l,v){var x=l.filter(function(y){return y[0]===v})[0];return x?x[1]:(v||'—')}
function chipE(e){var m=EMBM[e]||EMBM.prospecto;return '<span class="chip" style="--c:'+m.c+'">'+esc(m.n)+'</span>'}
function rk(e){return EMBM[e]?EMBM[e].r:-1}

/* ---------- fechas (Uruguay) ---------- */
function dayUY(ts){return ts?new Date(ts).toLocaleDateString('en-CA',{timeZone:TZ}):''}
function today(){return dayUY(new Date().toISOString())}
function addD(iso,n){var d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function rango(r){var t=today();if(r==='hoy')return [t,t];if(r==='ayer')return [addD(t,-1),addD(t,-1)];if(r==='semana')return [addD(t,-6),t];if(r==='mes')return [t.slice(0,8)+'01',t];if(r==='30d')return [addD(t,-29),t];return ['','']}
function enR(ts,R){if(!R[0])return true;var d=dayUY(ts);return !!d&&d>=R[0]&&d<=R[1]}
function nowLocal(){var d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
/* hora local de una zona → instante UTC */
function zonedToUtc(fecha,hora,tz){var guess=new Date(fecha+'T'+hora+':00Z');
  var p=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(guess).reduce(function(o,x){o[x.type]=x.value;return o},{});
  var asUtc=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);return new Date(guess.getTime()-(asUtc-guess.getTime())).toISOString()}
function enZona(ts,tz){return ts?new Date(ts).toLocaleString('es-UY',{timeZone:tz||TZ,weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):''}
function uuid(){return crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function val(id){var e=document.getElementById(id);return e?String(e.value||'').trim():''}
function pct(k,n){return n?(Math.round(k/n*1000)/10).toLocaleString('es-UY')+' %':'—'}
function dchip(iso){if(!iso)return '<span class="sv">Sin fecha</span>';var t=today(),c=iso<t?'late':iso===t?'today':'';return '<span class="dt '+c+'">'+esc(iso===t?'hoy':fd(iso))+'</span>'}
function igUrl(u){return u?'https://www.instagram.com/'+encodeURIComponent(u)+'/':''}

/* ---------- datos (PostgREST corta en 1000 filas: se pagina) ---------- */
async function pages(t,cols,fn){var all=[],s=0;while(true){var b=sb.from(t).select(cols);if(fn)b=fn(b);var r=await q(b.order('id').range(s,s+999));all=all.concat(r.data||[]);if((r.data||[]).length<1000)return all;s+=1000}}
var D=null,loading=null;
async function load(force){
  if(D&&!force&&Date.now()-D.t<60000)return D;
  if(loading&&!force)return loading;
  loading=(async function(){
    var r=await Promise.all([
      pages('crm_v_oportunidades','id,clave,empresa_id,empresa_clave,empresa,pais,nicho,instagram_usuario,ig_relacion,web,asesor,asesor_empresa,canal,canal_origen,embudo,embudo_en,atencion,proximo_paso,proximo_paso_fecha,valor,moneda,motivo_perdida,actualizado_en,primer_mensaje,primer_mensaje_sin_fecha,mensaje_texto,variante,ultima_respuesta,ultima_respuesta_texto,ultima_clasificacion,n_materiales,reuniones_pendientes,no_contactar'),
      pages('crm_v_act_embudo','id,empresa_id,conversacion_id,tanda_id,tipo,direccion,clasificacion,estado_envio,fecha_hecho,fecha_precision,variante,canal,canal_origen,asesor,pais,nicho'),
      pages('crm_v_reuniones','*'),
      pages('crm_tandas','id,clave,nombre,fecha,canal,responsable,notas',function(b){return b.eq('canal','Instagram')}),
      pages('crm_tanda_participantes','id,clave,tanda_id,empresa_id,actividad_id,variante,resultado')
    ]);
    D={t:Date.now(),O:r[0],A:r[1],R:r[2],T:r[3],P:r[4]};loading=null;return D})();
  return loading;
}
function opDe(empresaId){var L=D.O.filter(function(o){return o.empresa_id===empresaId});
  return L.sort(function(a,b){return ((a.embudo==='ganado'||a.embudo==='perdido')-(b.embudo==='ganado'||b.embudo==='perdido'))||String(b.actualizado_en).localeCompare(String(a.actualizado_en))})[0]}

/* ---------- eventos del embudo: una lista común para todas las métricas ----------
   Cada evento: empresa, fecha, tipo, asesor, canal de origen, canal de interacción, nicho, país.
   Se cuentan empresas únicas por tipo: varias respuestas de la misma persona son un prospecto. */
function eventos(){
  var op={},varEmp={},primer={},E=[];
  D.O.forEach(function(o){var p=op[o.empresa_id];if(!p||o.canal_origen&&!p.canal_origen)op[o.empresa_id]=o});
  var A=D.A.slice().sort(function(a,b){return String(a.fecha_hecho||'9').localeCompare(String(b.fecha_hecho||'9'))});
  A.forEach(function(a){var o=op[a.empresa_id]||{};
    var base={e:a.empresa_id,ts:a.fecha_hecho,as:a.asesor||'Sin asignar',co:a.canal_origen||'Sin dato',ci:a.canal,ni:a.nicho||'Sin nicho',pa:a.pais||'Sin país',sinFecha:!a.fecha_hecho};
    if(a.direccion==='saliente'&&a.tipo==='mensaje'){E.push(Object.assign({k:'msg'},base));
      if(a.fecha_hecho&&!primer[a.empresa_id]){primer[a.empresa_id]=1;varEmp[a.empresa_id]=a.variante||'Sin variante';E.push(Object.assign({k:'first'},base))}}
    var humana=a.direccion==='entrante'&&['respuesta','mensaje','derivacion','baja','llamada'].indexOf(a.tipo)>=0&&['respuesta_automatica','rebotado','demora_temporal'].indexOf(a.estado_envio)<0;
    if(humana){E.push(Object.assign({k:'resp'},base));
      if(POS.indexOf(a.clasificacion)>=0)E.push(Object.assign({k:'pos'},base));
      if(a.clasificacion==='solicita_info')E.push(Object.assign({k:'info'},base))}
    if(a.direccion==='saliente'&&a.tipo==='material')E.push(Object.assign({k:'mat'},base));
    if(a.direccion==='saliente'&&a.tipo==='propuesta')E.push(Object.assign({k:'prop'},base));
  });
  D.R.forEach(function(r){var o=op[r.empresa_id]||{};var base={e:r.empresa_id,as:r.asesor||o.asesor||'Sin asignar',co:r.canal_origen||o.canal_origen||'Sin dato',ci:'Reunión',ni:r.nicho||'Sin nicho',pa:r.pais||'Sin país'};
    E.push(Object.assign({k:'reuAg',ts:r.creado_en},base));
    if(r.estado==='realizada')E.push(Object.assign({k:'reuRe',ts:r.inicio},base))});
  D.O.forEach(function(o){if(o.embudo==='ganado')E.push({k:'venta',e:o.empresa_id,ts:o.embudo_en,as:o.asesor||'Sin asignar',co:o.canal_origen||'Sin dato',ci:o.canal,ni:o.nicho||'Sin nicho',pa:o.pais||'Sin país',valor:o.valor,moneda:o.moneda})});
  E.forEach(function(x){x.va=varEmp[x.e]||'Sin variante'});
  return E;
}
var KINDS=[['msg','Contactados','empresas con al menos un mensaje nuestro'],['first','Primeros mensajes','empresas contactadas por primera vez'],['resp','Respuestas humanas','empresas que respondieron'],['pos','Respuestas positivas','positivas o piden información'],['info','Solicitan información',''],['mat','Material presentado','videos, ejemplos o demos'],['reuAg','Reuniones agendadas',''],['reuRe','Reuniones realizadas',''],['prop','Propuestas económicas',''],['venta','Ventas','oportunidades ganadas']];
function medir(E,R,pred){var s={},sinF=0,msgs=0,valor={};KINDS.forEach(function(k){s[k[0]]={}});
  E.forEach(function(x){if(pred&&!pred(x))return;
    if(x.k==='msg'&&x.sinFecha){if(!R[0])s.msg[x.e]=1;sinF++;return}
    if(!enR(x.ts,R))return;s[x.k][x.e]=1;if(x.k==='msg')msgs++;
    if(x.k==='venta'&&x.valor){valor[x.moneda||'USD']=(valor[x.moneda||'USD']||0)+Number(x.valor)}});
  var n={};Object.keys(s).forEach(function(k){n[k]=Object.keys(s[k]).length});n.mensajes=msgs;n.sinFecha=sinF;n.valor=valor;
  // tasas sobre el mismo grupo de empresas: el numerador siempre sale del denominador (nunca más de 100 %)
  var both=function(a,b){return Object.keys(s[a]).filter(function(e){return s[b][e]}).length};
  n.t={resp:[both('first','resp'),n.first],pos:[both('resp','pos'),n.resp],reu:[both('resp','reuAg'),n.resp],cierre:[both('reuRe','venta'),n.reuRe]};
  return n}
function tasas(n){return [['Respuesta',n.t.resp[0],n.t.resp[1],'de las contactadas por primera vez, respondieron'],['Positivas',n.t.pos[0],n.t.pos[1],'de las que respondieron, positivas o piden información'],['Reunión',n.t.reu[0],n.t.reu[1],'de las que respondieron, agendaron reunión'],['Cierre',n.t.cierre[0],n.t.cierre[1],'de las reuniones realizadas, terminaron en venta']]}
function tasaCards(n){return '<div class="kpis">'+tasas(n).map(function(t){return kpi('Tasa · '+t[0],pct(t[1],t[2]),t[2]?t[1]+' de '+t[2]+' · '+t[3]:'sin base todavía · '+t[3],'')}).join('')+'</div>'}
function kpiCards(n,extra){return '<div class="kpis">'+(extra||'')+KINDS.map(function(k){
  var v=n[k[0]],d=k[2];if(k[0]==='msg')d=n.mensajes+' mensajes con fecha'+(n.sinFecha?' · '+n.sinFecha+' sin fecha verificada':'');if(k[0]==='venta'&&Object.keys(n.valor).length)d=Object.keys(n.valor).map(function(m){return m+' '+n.valor[m].toLocaleString('es-UY')}).join(' · ');
  return kpi(k[1],v,d,k[0]==='venta'&&v?'ok':k[0]==='pos'&&v?'s':'')}).join('')+'</div>'}
function grupoTabla(E,R,campo,titulo,top){
  var g={};E.forEach(function(x){g[x[campo]]=1});
  var rows=Object.keys(g).map(function(k){return [k,medir(E,R,function(x){return x[campo]===k})]}).filter(function(x){return x[1].msg||x[1].resp||x[1].reuAg||x[1].venta})
    .sort(function(a,b){return b[1].msg-a[1].msg||b[1].resp-a[1].resp});
  if(top)rows=rows.slice(0,top);
  return '<div class="card"><h3>'+esc(titulo)+'</h3>'+table(['Grupo','Contactados','Respondieron','Positivas','Material','Reuniones','Ventas','Tasa de respuesta'],rows.map(function(r){var n=r[1];
    return '<tr><td><b>'+esc(r[0])+'</b></td><td class="num">'+n.msg+'</td><td class="num">'+n.resp+'</td><td class="num">'+n.pos+'</td><td class="num">'+n.mat+'</td><td class="num">'+n.reuAg+(n.reuRe?'<div class="faint">'+n.reuRe+' hechas</div>':'')+'</td><td class="num">'+n.venta+'</td><td class="num">'+pct(n.t.resp[0],n.t.resp[1])+'<div class="faint">'+n.t.resp[0]+' de '+n.t.resp[1]+'</div>'+(n.first&&n.first<30?'<span class="chip warnf">Muestra chica</span>':'')+'</td></tr>'}),'Sin actividad en este rango.')+'</div>'}

/* ---------- seguimiento: oportunidades que piden una acción ---------- */
var ACTIVAS=['respuesta','material','conversacion_comercial','reunion_agendada','reunion_realizada','propuesta','negociacion'];
function necesitan(L){var t=today();return L.filter(function(o){return ACTIVAS.indexOf(o.embudo)>=0&&!o.no_contactar&&(!o.proximo_paso||!o.proximo_paso_fecha||o.proximo_paso_fecha<=t)})
  .sort(function(a,b){return String(a.proximo_paso_fecha||'0').localeCompare(String(b.proximo_paso_fecha||'0'))})}
function reunionesSinResultado(){var ahora=new Date().toISOString();return D.R.filter(function(r){return (r.estado==='agendada'||r.estado==='reprogramada')&&r.inicio&&r.inicio<ahora&&!r.reprograma_a})}
function segRows(L){return L.map(function(o){return '<div class="mc-row"><div class="mc-main"><b>'+esc(o.empresa)+'</b> '+chipE(o.embudo)+
  '<small>'+esc([o.asesor||'Sin asignar',o.canal_origen,o.nicho].filter(Boolean).join(' · '))+'</small><small>'+(o.proximo_paso?esc(o.proximo_paso)+' · '+dchip(o.proximo_paso_fecha):'<span class="sv">Sin próxima acción definida</span>')+'</small></div>'+
  '<div class="mc-acts"><button class="px-btn g xs" data-mc="seg" data-o="'+o.id+'">Agendar seguimiento</button><button class="px-btn g xs" data-emp="'+o.empresa_id+'">Ficha</button></div></div>'}).join('')}

/* ==================== INSTAGRAM ==================== */
var IG={as:'',r:'mes',et:'',seg:'',q:'',sub:'fichas',tanda:'',n:30};
function esIG(o){return o.canal_origen==='Instagram'||o.canal==='Instagram'||!!o.instagram_usuario&&o.canal_origen==null}
V.instagram=async function(){
  var el=$('#v-instagram');
  if(!D)el.innerHTML=head('Instagram','Prospección y conversaciones de Instagram, por asesor. Es una vista del CRM principal: lo que se registra acá aparece en la ficha y en el panel comercial.')+'<div class="empty">Cargando…</div>';
  await load();paintIG();
};
function head(t,d,extra){return '<div class="vh"><div><p class="px-eb">Prospección multicanal</p><h1>'+esc(t)+'</h1><p>'+esc(d)+'</p></div>'+(extra||'')+'</div>'}
function paintIG(){
  var el=$('#v-instagram'),R=rango(IG.r),t=today();
  var L=D.O.filter(esIG);
  // una ficha por empresa (la oportunidad abierta más reciente)
  var seen={};L=L.filter(function(o){var p=opDe(o.empresa_id);if(p.id!==o.id||seen[o.empresa_id])return false;seen[o.empresa_id]=1;return true});
  var porAs=function(o){return !IG.as||(IG.as==='sin'?!o.asesor_empresa:o.asesor_empresa===IG.as)};
  var base=L.filter(porAs);
  var E=eventos().filter(function(x){return x.co==='Instagram'&&(!IG.as||(IG.as==='sin'?x.as==='Sin asignar':x.as===IG.as))});
  var n=medir(E,R);
  var F=base.filter(function(o){var qq=IG.q.toLowerCase();
    if(qq&&(o.empresa+' '+(o.instagram_usuario||'')+' '+(o.nicho||'')).toLowerCase().indexOf(qq)<0)return false;
    if(IG.et&&o.embudo!==IG.et)return false;
    if(IG.seg==='vencidos'&&!(o.proximo_paso_fecha&&o.proximo_paso_fecha<t))return false;
    if(IG.seg==='hoy'&&o.proximo_paso_fecha!==t)return false;
    if(IG.seg==='sin_accion'&&!(ACTIVAS.indexOf(o.embudo)>=0&&!o.proximo_paso))return false;
    if(IG.tanda){var ids=D.P.filter(function(p){return p.tanda_id===IG.tanda}).map(function(p){return p.empresa_id});if(ids.indexOf(o.empresa_id)<0)return false}
    return true});
  var sinAs=L.filter(function(o){return !o.asesor_empresa}).length;
  var html=head('Instagram','Prospección y conversaciones de Instagram, por asesor. Abrir un perfil o copiar un mensaje no registra nada: el envío se confirma a mano.','<div class="acts" style="margin:0"><button class="px-btn p sm" data-mc="nuevo">Nuevo prospecto</button></div>')+
    '<div class="filters"><select class="in" id="ig_as">'+opts([['','Todos los asesores']].concat(ASES).concat([['sin','Sin asignar ('+sinAs+')']]),IG.as)+'</select><select class="in" id="ig_r">'+opts(RANGOS,IG.r)+'</select>'+
    '<span class="faint">Los indicadores usan el rango; las fichas muestran el estado actual.</span></div>'+
    kpiCards(n,kpi('Prospectos identificados',base.length,'fichas de Instagram (estado actual)','s'))+tasaCards(n)+
    '<div class="filters" style="margin-top:6px"><button class="px-btn sm '+(IG.sub==='fichas'?'p':'g')+'" data-igsub="fichas">Fichas <span class="cnt">'+F.length+'</span></button><button class="px-btn sm '+(IG.sub==='tandas'?'p':'g')+'" data-igsub="tandas">Tandas <span class="cnt">'+D.T.length+'</span></button><button class="px-btn sm '+(IG.sub==='seguir'?'p':'g')+'" data-igsub="seguir">Necesitan seguimiento <span class="cnt">'+necesitan(base).length+'</span></button></div>';
  if(IG.sub==='tandas')html+=tandasIG();
  else if(IG.sub==='seguir'){var S=necesitan(base);html+='<div class="card">'+(S.length?segRows(S):'<div class="empty">Ninguna conversación activa sin próxima acción ni vencida.</div>')+'</div>'}
  else{
    html+='<div class="filters"><input class="in q" id="ig_q" placeholder="Buscar por nombre, usuario o nicho" value="'+esc(IG.q)+'"><select class="in" id="ig_et">'+opts(EMB.map(function(x){return [x[0],x[1]]}),IG.et,'Todas las etapas')+'</select>'+
      '<select class="in" id="ig_seg">'+opts([['vencidos','Seguimiento vencido'],['hoy','Seguimiento para hoy'],['sin_accion','Activas sin próxima acción']],IG.seg,'Todo seguimiento')+'</select>'+
      (IG.tanda?'<button class="px-btn g sm" data-igtanda="">Tanda: '+esc((D.T.find(function(x){return x.id===IG.tanda})||{}).nombre||'')+' ✕</button>':'')+'</div>';
    html+=F.length?'<div class="grid3">'+F.slice(0,IG.n).map(ficha).join('')+'</div>'+(F.length>IG.n?'<div class="acts" style="justify-content:center"><button class="px-btn g sm" data-igmas>Ver '+Math.min(30,F.length-IG.n)+' más (de '+F.length+')</button></div>':''):'<div class="empty">No hay fichas con estos filtros.</div>';
  }
  el.innerHTML=html;
  bindIG();
}
function ficha(o){var u=o.instagram_usuario;
  return '<div class="card mc-card"><div class="mc-top"><div><b>'+esc(o.empresa)+'</b>'+(u?'<a class="mono faint" href="'+esc(igUrl(u))+'" target="_blank" rel="noopener noreferrer">@'+esc(u)+'</a>':'<span class="sv">Usuario sin cargar</span>')+'</div>'+chipE(o.embudo)+'</div>'+
    '<dl class="mc-dl"><dt>Asesor</dt><dd>'+(o.asesor_empresa?esc(o.asesor_empresa):'<span class="sv">Sin asignar</span>')+'</dd><dt>Relación</dt><dd>'+(o.ig_relacion?esc(lbl(REL,o.ig_relacion)):'<span class="sv">Sin definir</span>')+'</dd>'+
    '<dt>Nicho · país</dt><dd>'+esc([o.nicho,o.pais].filter(Boolean).join(' · ')||'—')+'</dd>'+
    '<dt>Primer contacto</dt><dd>'+(o.primer_mensaje?esc(fdt(o.primer_mensaje)):o.primer_mensaje_sin_fecha?'<span class="sv">Enviado, fecha sin verificar</span>':'<span class="muted">Sin mensaje registrado</span>')+'</dd>'+
    '<dt>Última respuesta</dt><dd>'+(o.ultima_respuesta?esc(fdt(o.ultima_respuesta))+(o.ultima_clasificacion?' · '+esc(lbl(CLS,o.ultima_clasificacion)):''):'<span class="muted">Sin respuesta registrada</span>')+'</dd>'+
    '<dt>Próxima acción</dt><dd>'+(o.proximo_paso?esc(o.proximo_paso)+' · '+dchip(o.proximo_paso_fecha):'<span class="muted">Sin definir</span>')+'</dd></dl>'+
    (o.mensaje_texto?'<p class="mc-msg">'+esc(String(o.mensaje_texto).slice(0,220))+'</p>':'')+
    (o.ultima_respuesta_texto?'<p class="mc-msg in">“'+esc(String(o.ultima_respuesta_texto).slice(0,180))+'”</p>':'')+
    '<div class="mc-acts">'+(u?'<a class="px-btn g xs" href="'+esc(igUrl(u))+'" target="_blank" rel="noopener noreferrer">Abrir perfil</a>':'')+
    '<button class="px-btn g xs" data-mc="copiar" data-o="'+o.id+'">Copiar mensaje</button><button class="px-btn p xs" data-mc="enviado" data-o="'+o.id+'">Registrar enviado</button>'+
    '<button class="px-btn g xs" data-mc="resp" data-o="'+o.id+'">Registrar respuesta</button><button class="px-btn g xs" data-mc="mat" data-o="'+o.id+'">Material</button>'+
    '<button class="px-btn g xs" data-mc="seg" data-o="'+o.id+'">Seguimiento</button><button class="px-btn g xs" data-mc="reu" data-o="'+o.id+'">Reunión</button>'+
    '<button class="px-btn g xs" data-mc="datos" data-o="'+o.id+'">Datos</button><button class="px-btn g xs" data-emp="'+o.empresa_id+'">Ficha</button></div></div>'}
function bindIG(){
  var on=function(id,k,num){var e=$('#'+id);if(e)e.onchange=function(){IG[k]=this.value;IG.n=30;paintIG()}};
  on('ig_as','as');on('ig_r','r');on('ig_et','et');on('ig_seg','seg');
  var qi=$('#ig_q');if(qi)qi.oninput=function(){IG.q=this.value;var p=this.selectionStart;paintIG();var n=$('#ig_q');if(n){n.focus();n.setSelectionRange(p,p)}};
}

/* ---------- tandas de Instagram ---------- */
function tandasIG(){
  var T=D.T.filter(function(t){return !IG.as||t.responsable===IG.as}).sort(function(a,b){return String(b.fecha||'').localeCompare(String(a.fecha||''))});
  return '<div class="filters"><button class="px-btn p sm" data-mc="tanda_nueva">Nueva tanda de Instagram</button><span class="faint">Apertura manual: cada envío se confirma desde la ficha con “Registrar enviado”.</span></div>'+
    (T.length?'<div class="grid3">'+T.map(function(t){
      var P=D.P.filter(function(p){return p.tanda_id===t.id}),emp=P.map(function(p){return p.empresa_id});
      var env=D.A.filter(function(a){return a.tanda_id===t.id&&a.direccion==='saliente'&&a.tipo==='mensaje'}).length;
      var resp={},act=0,reu=0;emp.forEach(function(e){if(D.A.some(function(a){return a.empresa_id===e&&a.direccion==='entrante'&&a.tipo!=='nota'}))resp[e]=1;var o=opDe(e);if(o&&ACTIVAS.indexOf(o.embudo)>=0)act++;reu+=D.R.filter(function(r){return r.empresa_id===e}).length});
      return '<div class="card"><p class="px-eb">'+esc(fd(t.fecha)||'Sin fecha')+' · '+esc(t.responsable||'Sin asesor')+'</p><h3 style="font-size:17px">'+esc(t.nombre)+'</h3>'+
        '<div class="kpis mini">'+kpi('Prospectos',P.length,'en la tanda','s')+kpi('Enviados',env,'confirmados','')+kpi('Respuestas',Object.keys(resp).length,'empresas',Object.keys(resp).length?'ok':'')+'</div>'+
        '<div class="kpis mini">'+kpi('Activas',act,'conversaciones','')+kpi('Reuniones',reu,'originadas','')+kpi('Pendientes',P.filter(function(p){return !p.actividad_id}).length,'sin envío','')+'</div>'+
        '<div class="acts"><button class="px-btn p xs" data-igtanda="'+t.id+'">Abrir fichas</button><button class="px-btn g xs" data-mc="tanda_sumar" data-t="'+t.id+'">Sumar prospectos</button></div></div>'}).join('')+'</div>':'<div class="empty">Todavía no hay tandas de Instagram'+(IG.as?' de '+esc(IG.as):'')+'.</div>')}

async function tandaNueva(){
  modal('<h3>Nueva tanda de Instagram</h3><div class="form"><label class="f"><span>Asesor</span><select class="in" id="tn_as">'+opts(ASES,IG.as&&IG.as!=='sin'?IG.as:'Andrés')+'</select></label><label class="f"><span>Fecha</span><input class="in" type="date" id="tn_f" value="'+today()+'"></label>'+
    '<label class="f full"><span>Notas (opcional)</span><input class="in" id="tn_n" placeholder="Ej.: estudios jurídicos investigados"></label></div><div class="acts"><button class="px-btn p sm" id="tn_ok">Crear</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
  $('#tn_ok').onclick=async function(){var as=val('tn_as'),f=val('tn_f');
    var r=await guardar({tandas:[{clave:'ig-tanda:'+uuid(),nombre:'Instagram · '+as+' · '+f.split('-').reverse().slice(0,2).join('/'),fecha:f,canal:'Instagram',responsable:as,notas:val('tn_n')||null}]},'completar');
    if(r){closeModal();toast('Tanda creada.','ok');await load(true);IG.sub='tandas';paintIG()}};
}
async function tandaSumar(tid){
  var t=D.T.find(function(x){return x.id===tid});var ya={};D.P.filter(function(p){return p.tanda_id===tid}).forEach(function(p){ya[p.empresa_id]=1});
  var L=D.O.filter(esIG).filter(function(o){return o.asesor_empresa===t.responsable&&(o.embudo==='prospecto'||o.embudo==='primer_mensaje')&&!ya[o.empresa_id]&&!o.no_contactar});
  var seen={};L=L.filter(function(o){if(seen[o.empresa_id])return false;seen[o.empresa_id]=1;return true});
  modal('<h3>Sumar prospectos · '+esc(t.nombre)+'</h3><p class="faint">Prospectos de Instagram de '+esc(t.responsable)+' que todavía no están en esta tanda. Sumarlos no envía nada.</p>'+
    (L.length?'<div class="mc-pick">'+L.map(function(o){return '<label class="tog"><input type="checkbox" value="'+o.id+'"> '+esc(o.empresa)+(o.instagram_usuario?' <span class="faint">@'+esc(o.instagram_usuario)+'</span>':'')+'</label>'}).join('')+'</div>':'<div class="empty">No hay prospectos de '+esc(t.responsable)+' disponibles. Cargalos con “Nuevo prospecto” o asigná el asesor en la ficha.</div>')+
    '<div class="acts">'+(L.length?'<button class="px-btn p sm" id="ts_ok">Sumar</button>':'')+'<button class="px-btn g sm" data-close>Cerrar</button></div>');
  var b=$('#ts_ok');if(b)b.onclick=async function(){var ids=$$('.mc-pick input:checked').map(function(i){return i.value});if(!ids.length){toast('Elegí al menos un prospecto.','warn');return}
    var P=ids.map(function(id){var o=D.O.find(function(x){return x.id===id});return {clave:'ig-part:'+t.clave+':'+o.empresa_clave,tanda:t.clave,empresa:o.empresa_clave,intento:1,resultado:'pendiente'}});
    var r=await guardar({participaciones:P},'completar');if(r){closeModal();toast(ids.length+' prospecto(s) sumados a la tanda.','ok');await load(true);paintIG()}};
}

/* ---------- nuevo prospecto y datos de Instagram ---------- */
function formProspecto(o){o=o||{};
  return '<div class="form"><label class="f full"><span>Empresa o contacto</span><input class="in" id="np_n" value="'+esc(o.empresa||'')+'"'+(o.id?' disabled':'')+'></label>'+
    '<label class="f"><span>Usuario de Instagram</span><input class="in" id="np_u" placeholder="@usuario o enlace al perfil" value="'+esc(o.instagram_usuario||'')+'"></label>'+
    '<label class="f"><span>Tipo de relación</span><select class="in" id="np_rel">'+opts(REL,o.ig_relacion||'','Sin definir')+'</select></label>'+
    '<label class="f"><span>Asesor responsable</span><select class="in" id="np_as">'+opts(ASES,o.asesor_empresa||(IG.as&&IG.as!=='sin'?IG.as:''),'Elegir')+'</select></label>'+
    '<label class="f"><span>Nicho</span><input class="in" id="np_ni" value="'+esc(o.nicho||'')+'" placeholder="Ej.: estudios jurídicos"></label>'+
    '<label class="f"><span>País</span><input class="in" id="np_pa" value="'+esc(o.pais||'')+'" placeholder="Ej.: Uruguay"></label></div>'}
function nuevo(){
  modal('<h3>Nuevo prospecto de Instagram</h3><p class="faint">Si la empresa ya existe (mismo usuario, nombre, web o teléfono) no se duplica: queda en Revisión. Una empresa no puede estar con los dos asesores.</p>'+formProspecto()+
    '<div class="acts"><button class="px-btn p sm" id="np_ok">Crear</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
  $('#np_ok').onclick=async function(){var n=val('np_n'),u=val('np_u'),as=val('np_as');
    if(!n||!u||!as){toast('Completá nombre, usuario y asesor.','warn');return}
    var uu=u.replace(/^.*instagram\.com\//i,'').replace(/^@/,'').split(/[/?#\s]/)[0].toLowerCase();
    var dup=D.O.find(function(o){return o.instagram_usuario===uu});
    if(dup){toast('Ese usuario ya está en el CRM: '+esc(dup.empresa)+' ('+esc(dup.asesor_empresa||'sin asesor')+').','warn');return}
    var k='ig:'+uu;
    var r=await guardar({empresas:[{clave:k,nombre:n,instagram_usuario:uu,redes:{instagram:'@'+uu},ig_relacion:val('np_rel')||null,asesor:as,nicho:val('np_ni')||null,pais:val('np_pa')||null,canal_origen:'Instagram',origen:'Instagram · '+as}],
      conversaciones:[{clave:'conv:'+k,empresa:k,canal:'Instagram',canal_origen:'Instagram',embudo:'prospecto',responsable:as}]},'completar');
    if(r){closeModal();toast('Prospecto creado.','ok');await load(true);paintIG()}};
}
function datos(o){
  modal('<h3>Datos de Instagram · '+esc(o.empresa)+'</h3>'+formProspecto(o)+'<div class="acts"><button class="px-btn p sm" id="np_ok">Guardar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
  $('#np_ok').onclick=async function(){var u=val('np_u').replace(/^.*instagram\.com\//i,'').replace(/^@/,'').split(/[/?#\s]/)[0].toLowerCase(),as=val('np_as');
    var e={clave:o.empresa_clave,ig_relacion:val('np_rel')||null,nicho:val('np_ni')||null,pais:val('np_pa')||null};if(u)e.instagram_usuario=u;
    if(as&&as!==o.asesor_empresa){var c=await sb.rpc('crm_fijar_clasificacion',{p_empresa:o.empresa_id,p:{asesor:as}});if(c.error){toast(esc(c.error.message),'bad');return}}
    var r=await guardar({empresas:[e]},'actualizar');if(r){closeModal();toast('Datos guardados.','ok');await load(true);rerenderMC()}};
}

/* ---------- mensaje comercial (5 bloques) ---------- */
var PRES={'Andrés':'Soy Andrés, fundador de GENIDEIA Company.','Agustín Alvez':'Soy Agustín, asesor de GENIDEIA Company.'};
var PRES_COMUN=' Desarrollamos sistemas digitales que ayudan a los negocios y profesionales a trabajar de forma más organizada, reducir tareas repetitivas y aprovechar mejor su tiempo.';
function armar(as,saludo,areas,plural){
  return [saludo.trim(),(PRES[as]||PRES['Andrés'])+PRES_COMUN,areas.trim(),plural?'Me pareció interesante compartirles estas posibilidades.':'Me pareció interesante compartirte estas posibilidades.',
    plural?'¿Les interesaría que les envíe un video breve con los ejemplos para que puedan ver cómo funcionan las soluciones?':'¿Te interesaría que te envíe un video breve con los ejemplos para que puedas ver cómo funcionan las soluciones?'].filter(Boolean).join('\n\n')}
function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
function copiar(o){
  var as=o.asesor_empresa||'Andrés',areasG=store('mc_areas:'+(o.nicho||''))||'';
  modal('<h3>Mensaje de primer contacto · '+esc(o.empresa)+'</h3><p class="faint">Estructura fija de 5 bloques. El saludo tiene que mencionar algo real y verificado del negocio. Sin enlaces ni videos en el primer contacto.</p><div class="form">'+
    '<label class="f"><span>Asesor</span><select class="in" id="cm_as">'+opts(ASES,as)+'</select></label><label class="f"><span>Trato</span><select class="in" id="cm_pl">'+opts([['1','Plural (les)'],['0','Singular (te)']],o.ig_relacion==='seguidor'?'0':'1')+'</select></label>'+
    '<label class="f full"><span>1 · Saludo y personalización</span><textarea class="in" id="cm_s" placeholder="Hola, ¿cómo están? Vi … de '+esc(o.empresa)+' (algo concreto de su actividad)"></textarea></label>'+
    '<label class="f full"><span>3 · Áreas de mejora para el sector</span><textarea class="in" id="cm_a" placeholder="Áreas posibles del rubro, sin atribuirles problemas que no verificaste">'+esc(areasG)+'</textarea></label>'+
    '<div class="f full"><span>Vista previa</span><pre class="orig" id="cm_pv"></pre></div></div>'+
    '<div class="acts"><button class="px-btn p sm" id="cm_ok">Copiar</button><button class="px-btn g sm" data-close>Cerrar</button></div>');
  var pv=function(){$('#cm_pv').textContent=armar(val('cm_as'),val('cm_s'),val('cm_a'),val('cm_pl')==='1')};
  ['cm_as','cm_pl','cm_s','cm_a'].forEach(function(id){$('#'+id).oninput=pv;$('#'+id).onchange=pv});pv();
  $('#cm_ok').onclick=async function(){if(!val('cm_s')||!val('cm_a')){toast('Completá el saludo y las áreas.','warn');return}
    var txt=armar(val('cm_as'),val('cm_s'),val('cm_a'),val('cm_pl')==='1');store('mc_areas:'+(o.nicho||''),val('cm_a'));store('mc_txt:'+o.id,txt);
    try{await navigator.clipboard.writeText(txt);toast('Copiado. Todavía no cuenta como enviado: cuando lo mandes, tocá “Registrar enviado”.','ok')}catch(e){toast('No se pudo copiar automáticamente: seleccioná el texto de la vista previa.','warn')}};
}

/* ---------- acciones que registran actividad ---------- */
function avanza(o,meta){return rk(meta)>rk(o.embudo)&&o.embudo!=='ganado'&&o.embudo!=='perdido'?meta:null}
function convPatch(o,extra){var c=Object.assign({clave:o.clave,empresa:o.empresa_clave},o.nueva?{canal:o.canal,canal_origen:o.canal,responsable:o.asesor_empresa}:{},extra);Object.keys(c).forEach(function(k){if(c[k]===undefined)delete c[k]});return c}
function campoProx(o,req){return '<label class="f"><span>Próxima acción'+(req?' (obligatoria)':'')+'</span><input class="in" id="x_pa" value="'+esc(o.proximo_paso||'')+'" placeholder="Ej.: enviar el video de ejemplos"></label><label class="f"><span>Fecha de seguimiento</span><input class="in" type="date" id="x_pf" value="'+esc(o.proximo_paso_fecha||'')+'"></label>'}
function canalSel(def){return '<label class="f"><span>Canal de esta interacción</span><select class="in" id="x_ca">'+opts(CANAL,def||'Instagram')+'</select></label>'}
function asesorDe(o){return o.asesor_empresa||null}
function needAsesor(o){return o.asesor_empresa?'':'<label class="f"><span>Asesor responsable</span><select class="in" id="x_as">'+opts(ASES,'','Elegir')+'</select></label>'}
async function fijarAsesorSiFalta(o){if(o.asesor_empresa)return true;var as=val('x_as');if(!as){toast('Elegí el asesor responsable.','warn');return false}
  var c=await sb.rpc('crm_fijar_clasificacion',{p_empresa:o.empresa_id,p:{asesor:as}});if(c.error){toast(esc(c.error.message),'bad');return false}o.asesor_empresa=as;return true}
function defCanal(o){return o.canal&&o.canal!=='Sin dato'&&o.canal!=='Otro'?o.canal:(o.canal_origen||'Instagram')}

function enviado(o){
  var tandas=D.T.filter(function(t){return !o.asesor_empresa||t.responsable===o.asesor_empresa});
  var enT=D.P.filter(function(p){return p.empresa_id===o.empresa_id&&!p.actividad_id}).map(function(p){return p.tanda_id})[0]||'';
  modal('<h3>Registrar mensaje enviado · '+esc(o.empresa)+'</h3><p class="faint">Confirmá solo si el mensaje ya salió. Enviado no es lo mismo que leído o recibido.</p><div class="form">'+needAsesor(o)+canalSel(defCanal(o))+
    '<label class="f"><span>Fecha y hora del envío</span><input class="in" type="datetime-local" id="x_fh" value="'+nowLocal()+'"></label>'+
    '<label class="f"><span>Variante del mensaje</span><input class="in" id="x_va" placeholder="Ej.: IG-5B-v1" value="'+esc(store('mc_var')||'')+'"></label>'+
    '<label class="f"><span>Tanda</span><select class="in" id="x_ta">'+opts(tandas.map(function(t){return [t.id,t.nombre]}),enT,'Sin tanda')+'</select></label>'+
    '<label class="f full"><span>Mensaje enviado</span><textarea class="in" id="x_tx">'+esc(store('mc_txt:'+o.id)||'')+'</textarea></label>'+campoProx(o,false)+'</div>'+
    '<label class="tog" style="margin-top:8px"><input type="checkbox" id="x_conf"> Confirmo que el mensaje fue enviado</label>'+
    '<div class="acts"><button class="px-btn p sm" id="x_ok">Registrar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
  $('#x_ok').onclick=async function(){if(!$('#x_conf').checked){toast('Marcá la confirmación de envío.','warn');return}
    if(!(await fijarAsesorSiFalta(o)))return;
    var ak='mc-msg:'+uuid(),t=D.T.find(function(x){return x.id===val('x_ta')}),fh=new Date(val('x_fh')).toISOString();store('mc_var',val('x_va'));
    var p={actividades:[{clave:ak,empresa:o.empresa_clave,conversacion:o.clave,tipo:'mensaje',direccion:'saliente',canal:val('x_ca'),fecha_hecho:fh,fecha_precision:'exacta',fecha_reporte:new Date().toISOString(),
        texto:val('x_tx')||null,variante:val('x_va')||null,asesor:o.asesor_empresa,tanda:t?t.clave:undefined,primera_respuesta:null,datos_extra:{confirmacion:'manual',confirmado_por:C.me()}}],
      conversaciones:[convPatch(o,{embudo:avanza(o,'primer_mensaje')||undefined,atencion:'esperando_prospecto',proximo_paso:val('x_pa')||undefined,proximo_paso_fecha:val('x_pf')||undefined})]};
    if(!p.actividades[0].tanda)delete p.actividades[0].tanda;
    if(t)p.participaciones=[{clave:'ig-part:'+t.clave+':'+o.empresa_clave,tanda:t.clave,empresa:o.empresa_clave,actividad:ak,variante:val('x_va')||null,intento:1,resultado:'enviado'}];
    var r=await guardar(p,'actualizar');if(r){closeModal();toast('Envío registrado.','ok');await load(true);rerenderMC()}};
}
function respuesta(o){
  var previa=D.A.some(function(a){return a.empresa_id===o.empresa_id&&a.direccion==='entrante'&&a.tipo!=='nota'});
  modal('<h3>Registrar respuesta · '+esc(o.empresa)+'</h3><p class="faint">Solo respuestas de una persona. Las automáticas no cuentan.</p><div class="form">'+canalSel(defCanal(o))+
    '<label class="f"><span>Fecha y hora</span><input class="in" type="datetime-local" id="x_fh" value="'+nowLocal()+'"></label>'+
    '<label class="f"><span>Clasificación</span><select class="in" id="x_cl">'+opts(CLS,'','Elegir')+'</select></label>'+
    '<label class="f"><span>¿Primera respuesta?</span><select class="in" id="x_pr">'+opts([['si','Sí'],['no','No']],previa?'no':'si')+'</select></label>'+
    '<label class="f full"><span>Texto o resumen fiel</span><textarea class="in" id="x_tx"></textarea></label>'+campoProx(o,true)+
    '<label class="f full"><span>Si es negativa: marcar la oportunidad como perdida</span><input class="in" id="x_mp" placeholder="Motivo de pérdida (dejar vacío para no cerrarla)"></label></div>'+
    '<div class="acts"><button class="px-btn p sm" id="x_ok">Registrar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
  $('#x_ok').onclick=async function(){var cl=val('x_cl'),mp=val('x_mp');if(!cl){toast('Elegí la clasificación.','warn');return}
    if(!mp&&!val('x_pa')){toast('Definí la próxima acción: una respuesta no puede quedar sin siguiente paso.','warn');return}
    var p={actividades:[{clave:'mc-resp:'+uuid(),empresa:o.empresa_clave,conversacion:o.clave,tipo:cl==='derivacion'?'derivacion':'respuesta',direccion:'entrante',canal:val('x_ca'),fecha_hecho:new Date(val('x_fh')).toISOString(),fecha_precision:'exacta',
        fecha_reporte:new Date().toISOString(),estado_envio:'respuesta_humana',clasificacion:cl,primera_respuesta:val('x_pr')==='si',texto:val('x_tx')||null,asesor:o.asesor_empresa}],
      conversaciones:[convPatch(o,mp?{embudo:'perdido',motivo_perdida:mp,atencion:'cerrado'}:{embudo:avanza(o,'respuesta')||undefined,atencion:'nos_toca_responder',proximo_paso:val('x_pa'),proximo_paso_fecha:val('x_pf')||undefined})]};
    var r=await guardar(p,'actualizar');if(r){closeModal();toast('Respuesta registrada.','ok');await load(true);rerenderMC()}};
}
function material(o){
  modal('<h3>Registrar material compartido · '+esc(o.empresa)+'</h3><p class="faint">Videos, ejemplos, demos o presentaciones. Si es un presupuesto o condiciones comerciales, elegí “Propuesta económica”.</p><div class="form">'+canalSel(defCanal(o))+
    '<label class="f"><span>Fecha y hora</span><input class="in" type="datetime-local" id="x_fh" value="'+nowLocal()+'"></label>'+
    '<label class="f"><span>Tipo</span><select class="in" id="x_ti">'+opts([['ejemplo_referencia','Material o ejemplo'],['propuesta_comercial','Propuesta económica'],['presupuesto','Presupuesto']],'ejemplo_referencia')+'</select></label>'+
    '<label class="f"><span>Qué se compartió</span><input class="in" id="x_tt" placeholder="Ej.: video de ejemplos del asistente"></label><label class="f full"><span>Enlace (si hay)</span><input class="in" id="x_url" placeholder="https://"></label>'+campoProx(o,true)+'</div>'+
    '<div class="acts"><button class="px-btn p sm" id="x_ok">Registrar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
  $('#x_ok').onclick=async function(){var ti=val('x_ti'),tt=val('x_tt');if(!tt||!val('x_pa')){toast('Completá qué se compartió y la próxima acción.','warn');return}
    var prop=ti!=='ejemplo_referencia',ak='mc-mat:'+uuid(),fh=new Date(val('x_fh')).toISOString();
    var p={actividades:[{clave:ak,empresa:o.empresa_clave,conversacion:o.clave,tipo:prop?'propuesta':'material',direccion:'saliente',canal:val('x_ca'),fecha_hecho:fh,fecha_precision:'exacta',fecha_reporte:new Date().toISOString(),asunto:tt,evidencia:val('x_url')||null,asesor:o.asesor_empresa}],
      materiales:[{clave:'mc-matr:'+uuid(),empresa:o.empresa_clave,conversacion:o.clave,actividad:ak,tipo:ti,titulo:tt,url:val('x_url')||null,enviado_en:fh}],
      conversaciones:[convPatch(o,{embudo:avanza(o,prop?'propuesta':'material')||undefined,atencion:'esperando_prospecto',proximo_paso:val('x_pa'),proximo_paso_fecha:val('x_pf')||undefined})]};
    var r=await guardar(p,'actualizar');if(r){closeModal();toast('Material registrado.','ok');await load(true);rerenderMC()}};
}
function seguimiento(o){
  modal('<h3>Seguimiento · '+esc(o.empresa)+'</h3><p class="faint">Define la próxima acción de esta oportunidad. Se guarda en la conversación: no crea una tarea aparte, así no se duplica.</p><div class="form">'+campoProx(o,true)+
    '<label class="f"><span>Etapa comercial</span><select class="in" id="x_em">'+opts(EMB.map(function(x){return [x[0],x[1]]}),o.embudo)+'</select></label>'+
    '<label class="f"><span>Estado de atención</span><select class="in" id="x_at">'+opts([['nos_toca_responder','Nos toca responder'],['esperando_prospecto','Esperando al prospecto'],['seguimiento_programado','Seguimiento programado'],['esperando_derivacion','Esperando derivación'],['pausado','Pausado'],['cerrado','Cerrado']],o.atencion||'seguimiento_programado')+'</select></label>'+
    '<label class="f"><span>Motivo de pérdida (si se pierde)</span><input class="in" id="x_mp" value="'+esc(o.motivo_perdida||'')+'"></label><label class="f"><span>Valor (si se gana)</span><input class="in" id="x_vl" inputmode="decimal" value="'+esc(o.valor==null?'':o.valor)+'" placeholder="USD"></label></div>'+
    '<div class="acts"><button class="px-btn p sm" id="x_ok">Guardar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
  $('#x_ok').onclick=async function(){var em=val('x_em');
    if(em==='perdido'&&!val('x_mp')){toast('Indicá el motivo de pérdida.','warn');return}
    if(em!=='perdido'&&em!=='ganado'&&!val('x_pa')){toast('Definí la próxima acción.','warn');return}
    if(rk(em)<rk(o.embudo)&&em!=='perdido'&&!confirm('La etapa elegida es anterior a la actual. ¿Retroceder igual?'))return;
    var vl=val('x_vl').replace(',','.');
    var r=await guardar({conversaciones:[convPatch(o,{embudo:em!==o.embudo?em:undefined,atencion:em==='ganado'||em==='perdido'?'cerrado':val('x_at'),proximo_paso:val('x_pa')||undefined,proximo_paso_fecha:val('x_pf')||undefined,motivo_perdida:val('x_mp')||undefined,valor:vl?Number(vl):undefined})]},'actualizar');
    if(r){closeModal();toast('Seguimiento guardado.','ok');await load(true);rerenderMC()}};
}
function reunion(o,prev){
  var z=prev?prev.zona_horaria:'America/Montevideo';
  modal('<h3>'+(prev?'Reprogramar reunión':'Registrar reunión')+' · '+esc(o?o.empresa:prev.empresa)+'</h3><div class="form">'+
    '<label class="f"><span>Fecha</span><input class="in" type="date" id="r_f" value="'+today()+'"></label><label class="f"><span>Hora</span><input class="in" type="time" id="r_h" value="10:00"></label>'+
    '<label class="f"><span>Zona horaria (de la hora indicada)</span><select class="in" id="r_z">'+opts(ZONAS,z)+'</select></label>'+
    '<label class="f"><span>Enlace</span><input class="in" id="r_l" placeholder="https://meet.google.com/…" value="'+esc(prev&&prev.enlace||'')+'"></label>'+
    '<label class="f full"><span>Participantes</span><input class="in" id="r_p" value="'+esc(prev&&prev.participantes||'')+'" placeholder="Nombres y roles"></label>'+
    '<label class="f full"><span>Notas</span><input class="in" id="r_n"></label></div><p class="faint" id="r_uy"></p>'+
    '<div class="acts"><button class="px-btn p sm" id="r_ok">Guardar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
  var uy=function(){try{$('#r_uy').textContent='En Uruguay: '+enZona(zonedToUtc(val('r_f'),val('r_h'),val('r_z')),TZ)}catch(e){}};['r_f','r_h','r_z'].forEach(function(i){$('#'+i).onchange=uy});uy();
  $('#r_ok').onclick=async function(){if(!val('r_f')||!val('r_h')){toast('Completá fecha y hora.','warn');return}
    var ini=zonedToUtc(val('r_f'),val('r_h'),val('r_z'));
    var fila={clave:'reu:'+uuid(),empresa_id:o?o.empresa_id:prev.empresa_id,conversacion_id:o?o.id:prev.conversacion_id,inicio:ini,zona_horaria:val('r_z'),enlace:val('r_l')||null,participantes:val('r_p')||null,notas:val('r_n')||null,estado:'agendada'};
    var r=await sb.from('crm_reuniones').insert(fila).select('id').single();if(r.error){toast(esc(r.error.message),'bad');return}
    if(prev){var u=await sb.from('crm_reuniones').update({estado:'reprogramada',reprograma_a:r.data.id}).eq('id',prev.id);if(u.error){toast(esc(u.error.message),'bad');return}}
    closeModal();toast(prev?'Reunión reprogramada.':'Reunión agendada.','ok');await load(true);rerenderMC()};
}
function resultado(r){
  var o=D.O.find(function(x){return x.id===r.conversacion_id})||opDe(r.empresa_id);
  modal('<h3>Resultado de la reunión · '+esc(r.empresa)+'</h3><p class="faint">'+esc(enZona(r.inicio,r.zona_horaria))+(r.zona_horaria!==TZ?' ('+esc(lbl(ZONAS,r.zona_horaria))+') · '+esc(enZona(r.inicio,TZ))+' en Uruguay':'')+'</p><div class="form">'+
    '<label class="f"><span>Estado</span><select class="in" id="r_e">'+opts(REU.filter(function(x){return x[0]!=='reprogramada'}),r.estado==='agendada'?'realizada':r.estado)+'</select></label>'+
    '<label class="f full"><span>Resultado</span><textarea class="in" id="r_r">'+esc(r.resultado||'')+'</textarea></label>'+
    '<label class="f"><span>Próxima acción</span><input class="in" id="r_pa" value="'+esc(r.proxima_accion||'')+'"></label><label class="f"><span>Fecha</span><input class="in" type="date" id="r_pf" value="'+esc(r.proxima_fecha||'')+'"></label></div>'+
    '<div class="acts"><button class="px-btn p sm" id="r_ok">Guardar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
  $('#r_ok').onclick=async function(){var e=val('r_e');if(e==='realizada'&&!val('r_r')){toast('Contá brevemente qué pasó en la reunión.','warn');return}
    if(e!=='cancelada'&&!val('r_pa')){toast('Definí la próxima acción.','warn');return}
    var u=await sb.from('crm_reuniones').update({estado:e,resultado:val('r_r')||null,proxima_accion:val('r_pa')||null,proxima_fecha:val('r_pf')||null}).eq('id',r.id);if(u.error){toast(esc(u.error.message),'bad');return}
    if(o&&val('r_pa'))await guardar({conversaciones:[convPatch(o,{proximo_paso:val('r_pa'),proximo_paso_fecha:val('r_pf')||undefined,atencion:'nos_toca_responder'})]},'actualizar');
    closeModal();toast('Reunión actualizada.','ok');await load(true);rerenderMC()};
}

/* ==================== REUNIONES ==================== */
V.reuniones=async function(){var el=$('#v-reuniones');if(!D)el.innerHTML=head('Reuniones','Agendadas, pendientes de resultado e historial.')+'<div class="empty">Cargando…</div>';await load();paintReu()};
function reuRow(r,acts){return '<div class="mc-row"><div class="mc-main"><b>'+esc(r.empresa)+'</b> <span class="chip">'+esc(lbl(REU,r.estado))+'</span>'+
  '<small>'+esc(enZona(r.inicio,r.zona_horaria))+(r.zona_horaria&&r.zona_horaria!==TZ?' ('+esc(lbl(ZONAS,r.zona_horaria))+') · '+esc(enZona(r.inicio,TZ))+' Uruguay':'')+'</small>'+
  '<small>'+esc([r.asesor||'Sin asesor','Origen: '+(r.canal_origen||'sin dato'),r.participantes].filter(Boolean).join(' · '))+'</small>'+(r.resultado?'<small>'+esc(r.resultado.slice(0,200))+'</small>':'')+(r.proxima_accion?'<small>Próximo: '+esc(r.proxima_accion)+' · '+dchip(r.proxima_fecha)+'</small>':'')+'</div>'+
  '<div class="mc-acts">'+(r.enlace&&/^https?:\/\//.test(r.enlace)?'<a class="px-btn g xs" href="'+esc(r.enlace)+'" target="_blank" rel="noopener noreferrer">Enlace</a>':'')+(acts||'')+'<button class="px-btn g xs" data-emp="'+r.empresa_id+'">Ficha</button></div></div>'}
function paintReu(){
  var ahora=new Date().toISOString(),R=D.R.slice().sort(function(a,b){return String(a.inicio).localeCompare(String(b.inicio))});
  var prox=R.filter(function(r){return (r.estado==='agendada')&&r.inicio>=ahora});
  var sin=reunionesSinResultado();
  var hist=R.filter(function(r){return ['realizada','no_asistio','cancelada','reprogramada'].indexOf(r.estado)>=0}).reverse();
  var ac=function(r){return '<button class="px-btn p xs" data-mc="reu_res" data-r="'+r.id+'">Registrar resultado</button><button class="px-btn g xs" data-mc="reu_rep" data-r="'+r.id+'">Reprogramar</button>'};
  $('#v-reuniones').innerHTML=head('Reuniones','Una reunión no se marca realizada porque pasó su horario: el resultado se registra a mano.')+
    '<div class="kpis">'+kpi('Próximas',prox.length,'agendadas','s')+kpi('Falta registrar resultado',sin.length,'ya pasó el horario',sin.length?'warn':'')+kpi('Realizadas',R.filter(function(r){return r.estado==='realizada'}).length,'histórico','ok')+kpi('No asistió',R.filter(function(r){return r.estado==='no_asistio'}).length,'histórico','')+'</div>'+
    '<div class="grid2"><div class="stack"><div class="card"><h3>Falta registrar resultado</h3>'+(sin.map(function(r){return reuRow(r,ac(r))}).join('')||'<div class="empty">Nada pendiente.</div>')+'</div>'+
    '<div class="card"><h3>Próximas</h3>'+(prox.map(function(r){return reuRow(r,ac(r))}).join('')||'<div class="empty">No hay reuniones agendadas.</div>')+'</div></div>'+
    '<div class="card"><h3>Historial</h3>'+(hist.map(function(r){return reuRow(r,r.estado==='no_asistio'?'<button class="px-btn g xs" data-mc="reu_rep" data-r="'+r.id+'">Reprogramar</button>':'<button class="px-btn g xs" data-mc="reu_res" data-r="'+r.id+'">Editar</button>')}).join('')||'<div class="empty">Sin historial.</div>')+'</div></div>';
}

/* ==================== COMERCIAL ==================== */
var CM={r:'hoy',as:'',co:'',ni:'',pa:''};
V.comercial=async function(){var el=$('#v-comercial');if(!D)el.innerHTML=head('Panel comercial','Contactos, respuestas, reuniones y ventas por asesor, canal, nicho y país.')+'<div class="empty">Cargando…</div>';await load();paintCM()};
function paintCM(){
  var R=rango(CM.r),E=eventos(),t=today();
  var all=function(k){var o={};E.forEach(function(x){o[x[k]]=1});return Object.keys(o).sort().map(function(v){return [v,v]})};
  var F=E.filter(function(x){return (!CM.as||x.as===CM.as)&&(!CM.co||x.co===CM.co)&&(!CM.ni||x.ni===CM.ni)&&(!CM.pa||x.pa===CM.pa)});
  var n=medir(F,R);
  // hoy: quién contactó a cuántos y por qué canal (canal de la interacción)
  var hoy={};E.forEach(function(x){if(x.k!=='msg'||dayUY(x.ts)!==t)return;var k=x.as+'|'+x.ci;hoy[k]=hoy[k]||{};hoy[k][x.e]=1});
  var hoyRows=['Andrés','Agustín Alvez','Sin asignar'].map(function(a){var c=CANAL.map(function(cn){return Object.keys(hoy[a+'|'+cn[0]]||{}).length});var tot=c.reduce(function(s,v){return s+v},0);return '<tr><td><b>'+esc(a)+'</b></td>'+c.map(function(v){return '<td class="num">'+v+'</td>'}).join('')+'<td class="num"><b>'+tot+'</b></td></tr>'});
  var O=D.O.filter(function(o){return (!CM.as||o.asesor===CM.as)&&(!CM.co||o.canal_origen===CM.co)});var S=necesitan(O),sin=reunionesSinResultado();
  $('#v-comercial').innerHTML=head('Panel comercial','Empresas únicas por etapa, a partir de actividades registradas. Enviado no es leído; lo que no está registrado no se cuenta ni se estima.')+
    '<div class="card" style="margin-bottom:16px"><h3>Contactados hoy</h3>'+table(['Asesor'].concat(CANAL.map(function(c){return c[1]})).concat(['Total']),hoyRows,'')+'<p class="faint" style="margin:8px 2px 0">Empresas distintas con un mensaje nuestro confirmado hoy, por canal de la interacción.</p></div>'+
    '<div class="filters"><select class="in" id="cm_r">'+opts(RANGOS,CM.r)+'</select><select class="in" id="cm_as">'+opts(all('as'),CM.as,'Todos los asesores')+'</select><select class="in" id="cm_co">'+opts(all('co'),CM.co,'Todos los canales de origen')+'</select>'+
    '<select class="in" id="cm_ni">'+opts(all('ni'),CM.ni,'Todos los nichos')+'</select><select class="in" id="cm_pa">'+opts(all('pa'),CM.pa,'Todos los países')+'</select></div>'+
    kpiCards(n)+tasaCards(n)+
    '<div class="card" style="margin-bottom:16px"><h3>Necesitan seguimiento hoy <span class="cnt">'+(S.length+sin.length)+'</span></h3>'+(sin.length?'<p class="faint">Reuniones que ya pasaron sin resultado registrado: '+sin.map(function(r){return esc(r.empresa)}).join(', ')+' (ver pestaña Reuniones).</p>':'')+(S.length?segRows(S.slice(0,40)):'<div class="empty">Todas las conversaciones activas tienen una próxima acción a futuro.</div>')+(S.length>40?'<p class="faint">Se muestran 40 de '+S.length+'.</p>':'')+'</div>'+
    '<div class="grid2 eq">'+grupoTabla(F,R,'co','Por canal de origen')+grupoTabla(F,R,'as','Por asesor')+'</div><div class="grid2 eq" style="margin-top:16px">'+grupoTabla(F,R,'ni','Por nicho',15)+grupoTabla(F,R,'pa','Por país',15)+'</div>'+
    '<div style="margin-top:16px">'+grupoTabla(F,R,'va','Por variante del primer mensaje',20)+'</div>'+
    '<p class="faint" style="margin-top:12px">Canal de origen: por dónde se consiguió el prospecto (una venta que siguió por WhatsApp se atribuye a Instagram si empezó ahí). Asesor: el de la actividad; si falta, el de la empresa o el responsable de la tanda. Los mensajes sin fecha verificada solo cuentan en el histórico.</p>';
  ['r','as','co','ni','pa'].forEach(function(k){$('#cm_'+k).onchange=function(){CM[k]=this.value;paintCM()}});
}


/* ==================== CARTERA (validación de prospectos históricos) ====================
   Lee crm_v_cartera (migración 20261127120000). Aprobar no es contactar: el estado pasa a "contactado"
   solo cuando hay un mensaje saliente registrado. Abrir WhatsApp o copiar el mensaje no registra nada. */
var VAL=[['aprobado','Aprobado'],['pendiente_verificacion','Pendiente de verificación'],['no_calificado','No calificado'],['duplicado','Duplicado'],['no_contactar','No contactar'],['revision_necesaria','Revisión necesaria']];
var CEST={verificado:'Verificado',pendiente:'Pendiente de comprobación',no_disponible:'No disponible',no_apto:'No apto'};
var CCOL={verificado:'#4BE39A',pendiente:'#FFB84D',no_disponible:'#7E8796',no_apto:'#FF6B7A'};
var ECON={aprobado_disponible:'Aprobado · disponible',asignado_sin_contactar:'Asignado · sin contactar',contactado:'Contactado'};
var CA={as:'',vista:'aprobados',lote:'',q:''},CD=null;
V.cartera=async function(){var el=$('#v-cartera');if(!CD)el.innerHTML=head('Cartera validada','Prospectos históricos revisados uno por uno: identidad, encaje, canales verificados y duplicados.')+'<div class="empty">Cargando…</div>';
  CD=await pages('crm_v_cartera','*');await load();paintCA()};
function canalChip(k,c){if(!c)return '';var col=CCOL[c.estado]||'#7E8796';return '<span class="chip" style="--c:'+col+'" title="'+esc([c.valor,c.fuente,c.nota,c.fecha].filter(Boolean).join(' · '))+'">'+esc(k)+': '+esc(CEST[c.estado]||c.estado)+'</span>'}
function waUrl(c,msg){if(!c||c.estado!=='verificado'||!c.valor)return '';var v=String(c.valor);if(/^https?:\/\//.test(v))return v;var d=v.replace(/\D/g,'');
  if(d.indexOf('5980')===0)d='598'+d.slice(4);return 'https://wa.me/'+d+(msg?'?text='+encodeURIComponent(msg):'')}
function paintCA(){
  var L=CD.filter(function(x){return (!CA.as||(CA.as==='sin'?!x.asesor:x.asesor===CA.as))&&(!CA.lote||x.validacion_lote===CA.lote)&&(!CA.q||(x.nombre+' '+(x.nicho||'')).toLowerCase().indexOf(CA.q.toLowerCase())>=0)});
  var ap=L.filter(function(x){return x.validacion==='aprobado'}),pe=L.filter(function(x){return x.validacion==='pendiente_verificacion'||x.validacion==='revision_necesaria'}),de=L.filter(function(x){return ['no_calificado','duplicado','no_contactar'].indexOf(x.validacion)>=0});
  var cnt=function(f){return ap.filter(f).length};
  var lotes={};CD.forEach(function(x){if(x.validacion_lote)lotes[x.validacion_lote]=1});
  var html=head('Cartera validada','Prospectos históricos revisados uno por uno. Aprobado no es contactado: el estado cambia solo cuando se registra un envío.')+
    '<div class="filters"><select class="in" id="ca_as">'+opts([['','Todos los asesores']].concat(ASES).concat([['sin','Sin asignar']]),CA.as)+'</select><select class="in" id="ca_lote">'+opts(Object.keys(lotes).sort().map(function(k){return [k,k]}),CA.lote,'Todos los lotes')+'</select><input class="in q" id="ca_q" placeholder="Buscar empresa o nicho" value="'+esc(CA.q)+'"></div>'+
    '<div class="kpis">'+kpi('Aprobados',ap.length,'disponibles para tandas','ok')+kpi('Asignados sin contactar',cnt(function(x){return x.estado_contacto==='asignado_sin_contactar'}),'reservados, sin envío registrado','s')+kpi('Contactados',cnt(function(x){return x.estado_contacto==='contactado'}),'con un mensaje registrado','')+
    kpi('WhatsApp verificado',cnt(function(x){return (x.canales.whatsapp||{}).estado==='verificado'}),'empresas aprobadas','')+kpi('Email verificado',cnt(function(x){return (x.canales.email||{}).estado==='verificado'}),'empresas aprobadas','')+kpi('Instagram verificado',cnt(function(x){return (x.canales.instagram||{}).estado==='verificado'}),'empresas aprobadas','')+
    kpi('Pendientes',pe.length,'falta información','warn')+kpi('Descartes y duplicados',de.length,'no se prospectan','')+'</div>'+
    '<div class="filters"><button class="px-btn sm '+(CA.vista==='aprobados'?'p':'g')+'" data-cav="aprobados">Aprobados <span class="cnt">'+ap.length+'</span></button><button class="px-btn sm '+(CA.vista==='pendientes'?'p':'g')+'" data-cav="pendientes">Pendientes <span class="cnt">'+pe.length+'</span></button><button class="px-btn sm '+(CA.vista==='descartes'?'p':'g')+'" data-cav="descartes">Descartes y duplicados <span class="cnt">'+de.length+'</span></button></div>';
  if(CA.vista==='aprobados')html+=ap.length?'<div class="grid3">'+ap.map(fichaCA).join('')+'</div>':'<div class="empty">No hay aprobados con estos filtros.</div>';
  else{var T=CA.vista==='pendientes'?pe:de;html+=table(['Empresa','Estado','Motivo','Evidencia','Lote'],T.map(function(x){return '<tr data-emp="'+x.id+'"><td><b>'+esc(x.nombre)+'</b><div class="faint">'+esc([x.nicho,x.pais].filter(Boolean).join(' · '))+'</div></td><td><span class="chip">'+esc(lbl(VAL,x.validacion))+'</span></td><td class="w">'+esc(x.validacion_motivo||'')+'</td><td class="w faint">'+esc(x.validacion_evidencia||'')+'</td><td class="faint">'+esc(x.validacion_lote||'')+'</td></tr>'}),'Nada en esta lista.')}
  $('#v-cartera').innerHTML=html;
  $('#ca_as').onchange=function(){CA.as=this.value;paintCA()};$('#ca_lote').onchange=function(){CA.lote=this.value;paintCA()};
  $('#ca_q').oninput=function(){CA.q=this.value;var p=this.selectionStart;paintCA();var n=$('#ca_q');n.focus();n.setSelectionRange(p,p)};
}
function fichaCA(x){var c=x.canales||{},borr=/borrador/.test(x.mensaje_sugerido_estado||''),wa=waUrl(c.whatsapp,borr?'':x.mensaje_sugerido);
  var est=x.estado_contacto;
  return '<div class="card mc-card"><div class="mc-top"><div><b>'+esc(x.nombre)+'</b><span class="faint">'+esc([x.nicho,x.pais].filter(Boolean).join(' · '))+'</span></div><span class="chip" style="--c:'+(est==='contactado'?'#4BE39A':'#38D6FF')+'">'+esc(ECON[est]||'—')+'</span></div>'+
    '<dl class="mc-dl"><dt>Responsable</dt><dd>'+(x.asesor?esc(x.asesor):'<span class="sv">Sin asignar</span>')+'</dd><dt>Canal preferente</dt><dd>'+esc(x.canal_preferente||'—')+'</dd>'+
    '<dt>Actividad</dt><dd>'+esc(x.actividad_verificada||'—')+'</dd><dt>Origen</dt><dd>'+esc(x.origen||'—')+'</dd>'+
    (c.email&&c.email.valor?'<dt>Email</dt><dd class="mono">'+esc(c.email.valor)+'</dd>':'')+(c.whatsapp&&c.whatsapp.valor?'<dt>WhatsApp</dt><dd class="mono">'+esc(c.whatsapp.valor)+'</dd>':'')+
    (c.instagram&&c.instagram.valor?'<dt>Instagram</dt><dd><a class="mono" href="'+esc(igUrl(c.instagram.valor))+'" target="_blank" rel="noopener noreferrer">@'+esc(c.instagram.valor)+'</a></dd>':'')+'</dl>'+
    '<div class="f-flags">'+canalChip('WhatsApp',c.whatsapp)+canalChip('Email',c.email)+canalChip('Instagram',c.instagram)+'</div>'+
    (x.mensaje_sugerido?'<p class="mc-msg">'+esc(x.mensaje_sugerido)+'</p>':'')+(borr?'<span class="chip warnf">Borrador: falta aprobar el párrafo de comercios. WhatsApp abre sin texto.</span>':'')+
    '<div class="mc-acts">'+(wa?'<a class="px-btn g xs" href="'+esc(wa)+'" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>':'')+(x.mensaje_sugerido?'<button class="px-btn g xs" data-ca="copiar" data-i="'+x.id+'">Copiar mensaje</button>':'')+
    (x.mensaje_instagram?'<button class="px-btn g xs" data-ca="copiar_ig" data-i="'+x.id+'">Copiar mensaje IG</button>':'')+
    (x.asesor&&est!=='contactado'?'<button class="px-btn p xs" data-ca="enviado" data-i="'+x.id+'">Registrar enviado</button>':'')+'<button class="px-btn g xs" data-emp="'+x.id+'">Ficha</button></div></div>'}
document.addEventListener('click',async function(ev){var el=ev.target.closest('[data-cav],[data-ca]');if(!el)return;
  if(el.dataset.cav){CA.vista=el.dataset.cav;paintCA();return}
  ev.stopPropagation();var x=CD.find(function(y){return y.id===el.dataset.i});if(!x)return;
  if(el.dataset.ca==='copiar'||el.dataset.ca==='copiar_ig'){var t=el.dataset.ca==='copiar'?x.mensaje_sugerido:x.mensaje_instagram;
    try{await navigator.clipboard.writeText(t);toast('Copiado. Todavía no cuenta como enviado.','ok')}catch(e){toast('No se pudo copiar automáticamente.','warn')}return}
  if(el.dataset.ca==='enviado'){var o={id:'cart:'+x.id,clave:'conv:'+x.clave,empresa_clave:x.clave,empresa_id:x.id,empresa:x.nombre,embudo:'prospecto',asesor_empresa:x.asesor,canal:x.canal_preferente,canal_origen:x.canal_preferente,nueva:true};
    var exist=D.O.find(function(y){return y.empresa_id===x.id});if(exist){o=exist}
    store('mc_txt:'+o.id,x.mensaje_sugerido||'');enviado(o)}
},true);

/* ---------- Hoy: suma oportunidades sin próxima acción y reuniones sin resultado ---------- */
var hoyOrig=V.hoy;
V.hoy=async function(){await hoyOrig();try{await load();var S=necesitan(D.O),sin=reunionesSinResultado();if(!S.length&&!sin.length)return;
  var el=$('#v-hoy'),box=document.createElement('div');box.className='card';box.style.marginTop='16px';
  box.innerHTML='<h3>Oportunidades que necesitan seguimiento <span class="cnt">'+(S.length+sin.length)+'</span></h3><p class="faint">Conversaciones activas (desde “respuesta recibida”) sin próxima acción o con la fecha vencida, y reuniones sin resultado.</p>'+
    sin.map(function(r){return reuRow(r,'<button class="px-btn p xs" data-mc="reu_res" data-r="'+r.id+'">Registrar resultado</button>')}).join('')+segRows(S.slice(0,25))+(S.length>25?'<p class="faint">Ver todas en Comercial.</p>':'');
  el.appendChild(box)}catch(e){console.error(e)}};

/* ---------- clics ---------- */
function rerenderMC(){var v=(location.hash||'').slice(1).split('/')[0];if(v==='instagram')paintIG();else if(v==='reuniones')paintReu();else if(v==='comercial')paintCM();else if(v==='cartera'){pages('crm_v_cartera','*').then(function(r){CD=r;paintCA()})}else if(V[v])V[v]()}
document.addEventListener('click',function(ev){var t=ev.target,el;
  if((el=t.closest('[data-igsub]'))){IG.sub=el.dataset.igsub;paintIG();return}
  if((el=t.closest('[data-igtanda]'))){IG.tanda=el.dataset.igtanda;IG.sub='fichas';IG.n=30;paintIG();return}
  if(t.closest('[data-igmas]')){IG.n+=30;paintIG();return}
  if(!(el=t.closest('[data-mc]')))return;
  ev.stopPropagation();
  var a=el.dataset.mc,o=el.dataset.o?D.O.find(function(x){return x.id===el.dataset.o}):null,r=el.dataset.r?D.R.find(function(x){return x.id===el.dataset.r}):null;
  if(a==='nuevo')return nuevo();if(a==='tanda_nueva')return tandaNueva();if(a==='tanda_sumar')return tandaSumar(el.dataset.t);
  if(a==='reu_res'&&r)return resultado(r);if(a==='reu_rep'&&r)return reunion(null,r);
  if(!o)return;
  ({copiar:copiar,enviado:enviado,resp:respuesta,mat:material,seg:seguimiento,reu:function(x){reunion(x)},datos:datos})[a](o);
},true);
};
