/* CRM GENIDEIA v2. Datos en Supabase (proyecto propio del CRM). Sin dependencias además del cliente de Supabase.
   Regla de oro: lo que no está en el origen se muestra como "Sin verificar" o "Pendiente de completar". */
(function(){
'use strict';

var SB_URL='https://fzrrbqqvteyuwbvfgvnx.supabase.co',SB_KEY='sb_publishable_g4URDx6lcAN9U_sFUcMUVQ_lFTxCnjc';
var sb=null,me='';
var PAGE=50,MAX_IMPORT=2*1024*1024;

/* ---------- catálogos ---------- */
var ETAPAS=[
  ['sin_contactar','Sin contactar','#8C96A8'],['contacto_iniciado','Contacto iniciado','#9FB3FF'],['conversacion_abierta','Conversación abierta','#38D6FF'],
  ['exploracion','Exploración o diagnóstico','#5AA9FF'],['propuesta_presentada','Propuesta presentada','#FFB84D'],['negociacion','Negociación','#B79CFF'],
  ['ganado','Ganado','#4BE39A'],['perdido','Perdido','#FF6B7A']];
var ATENCION=[
  ['nos_toca_responder','Nos toca responder','#FF6B7A'],['esperando_prospecto','Esperando al prospecto','#9FB3FF'],['seguimiento_programado','Seguimiento programado','#38D6FF'],
  ['esperando_derivacion','Esperando derivación interna','#B79CFF'],['pausado','Pausado','#D7B4FF'],['cerrado','Cerrado','#7E8796']];
var TIPOS={mensaje:'Mensaje',respuesta:'Respuesta',llamada:'Llamada',reunion:'Reunión',propuesta:'Propuesta',material:'Material enviado',seguimiento:'Seguimiento',derivacion:'Derivación',rebote:'Rebote',baja:'Baja',nota:'Nota'};
var ENVIO={envio_confirmado:'Envío confirmado',sin_error_al_corte:'Sin error detectado al corte',demora_temporal:'Demora temporal',rebotado:'Rebotado',respuesta_automatica:'Respuesta automática',respuesta_humana:'Respuesta humana'};
var CLASIF={interes_concreto:'Interés concreto',cordial_sin_compromiso:'Cordial sin compromiso',negativa_baja:'Negativa o baja',derivacion:'Derivación'};
var MATS={ejemplo_referencia:'Ejemplo de referencia',propuesta_comercial:'Propuesta comercial',presupuesto:'Presupuesto'};
var ROLES={decide:'Decide',influye:'Influye',usa:'Usa',filtra:'Filtra',deriva:'Deriva'};
var REVT={posible_duplicado:'Posibles duplicados',conflicto:'Conflictos',verificar_dato:'Verificar dato',sin_empresa:'Sin empresa',fecha_sin_verificar:'Fecha sin verificar',incompleto:'Incompletos',sin_desglosar:'Sin desglosar'};
var CANALES=['Email','WhatsApp','Llamada','Reunión','LinkedIn','Instagram','Visita','Otro'];
function mapOf(a){var m={};a.forEach(function(x){m[x[0]]={n:x[1],c:x[2]}});return m}
var EM=mapOf(ETAPAS),AM=mapOf(ATENCION);

/* ---------- utilidades ---------- */
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function safeUrl(u){u=String(u||'').trim();return /^https?:\/\//i.test(u)?u:''}
function link(u,txt){var s=safeUrl(u);return s?'<a href="'+esc(s)+'" target="_blank" rel="noopener noreferrer">'+esc(txt||'Abrir')+'</a>':esc(u||'')}
function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function addDays(iso,n){var d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
var TZ='America/Montevideo';
function fdt(ts){if(!ts)return '';var d=new Date(ts);if(isNaN(d))return esc(ts);return d.toLocaleString('es-UY',{timeZone:TZ,day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function fd(ts){if(!ts)return '';var d=new Date(String(ts).length===10?ts+'T12:00:00':ts);if(isNaN(d))return esc(ts);return d.toLocaleDateString('es-UY',{timeZone:TZ,day:'numeric',month:'short',year:'numeric'})}
function rel(iso){if(!iso)return '';var d=Math.round((new Date(iso.slice(0,10)+'T12:00:00')-new Date(today()+'T12:00:00'))/864e5);
  if(d===0)return 'hoy';if(d===1)return 'mañana';if(d===-1)return 'ayer';return d<0?'hace '+(-d)+' d':'en '+d+' d'}
function dchip(iso){if(!iso)return '<span class="sv">Sin fecha</span>';var t=today(),c=iso<t?'late':iso===t?'today':'';return '<span class="dt '+c+'" title="'+esc(fd(iso))+'">'+esc(rel(iso))+'</span>'}
function sv(t){return '<span class="sv">'+esc(t||'Sin verificar')+'</span>'}
function pend(v){return v==null||v===''?'<span class="sv">Pendiente de completar</span>':esc(v)}
function initials(n){return String(n||'?').trim().split(/\s+/).slice(0,2).map(function(w){return w[0]}).join('').toUpperCase()}
function av(n,c){return '<span class="av" style="background:linear-gradient(135deg,'+(c||'#38D6FF')+',#2a7bff)">'+esc(initials(n))+'</span>'}
function etapa(id){var e=EM[id]||EM.sin_contactar;return '<span class="chip" style="--c:'+e.c+'">'+esc(e.n)+'</span>'}
function atenc(id){if(!id)return '<span class="sv">Sin definir</span>';var a=AM[id];return '<span class="chip" style="--c:'+a.c+'">'+esc(a.n)+'</span>'}
function uuid(){return (crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2))}
function strip(h){if(!/<[a-z][\s\S]*>/i.test(h||''))return h||'';var d=document.createElement('div');d.innerHTML=String(h).replace(/<(br|\/p|\/div|\/li)>/gi,'\n$&');return (d.textContent||'').replace(/\n{3,}/g,'\n\n').trim()}
function qs(q){return '%'+String(q).replace(/[%_,()*\\]/g,' ').trim()+'%'}
function opts(list,val,empty){return (empty?'<option value="">'+esc(empty)+'</option>':'')+list.map(function(x){return '<option value="'+esc(x[0])+'"'+(x[0]===val?' selected':'')+'>'+esc(x[1])+'</option>'}).join('')}
function sel(o){return Object.keys(o).map(function(k){return [k,o[k]]})}

var toastT=null;
function toast(msg,kind){var t=$('#toast');t.className='toast on '+(kind||'');t.innerHTML=msg;clearTimeout(toastT);toastT=setTimeout(function(){t.className='toast'},kind==='bad'?7000:4200)}
function setSync(s,t){var e=$('#sync');e.className='sync '+s;e.querySelector('span').textContent=t}
async function q(p){var r=await p;if(r.error){console.error(r.error);toast('Error: '+esc(r.error.message),'bad');throw r.error}return r}

/* Todas las escrituras pasan por crm_importar: quedan en el historial de cambios y no duplican. */
async function guardar(payload,modo){
  setSync('busy','Guardando');
  try{
    var r=await q(sb.rpc('crm_importar',{p:payload,p_aplicar:true,p_modo:modo||'actualizar',p_archivo:'edición manual · '+me}));
    var rep=r.data;
    if(rep.fallidos&&rep.fallidos.length){toast('No se pudo guardar: '+esc(rep.fallidos[0].error),'bad');setSync('bad','Error');return null}
    setSync('ok','Guardado');
    if(rep.coincidencias&&rep.coincidencias.length)toast('Guardado. Hay '+rep.coincidencias.length+' posible(s) duplicado(s): quedaron en Revisión, no se fusionó nada.','warn');
    return rep;
  }catch(e){setSync('bad','Error');return null}
}

/* ---------- navegación ---------- */
var view='hoy',VIEWS={};
function show(v,keep){
  if(!VIEWS[v])v='hoy';view=v;
  $$('#tabs button').forEach(function(b){b.classList.toggle('on',b.dataset.view===v)});
  $$('.view').forEach(function(s){s.classList.toggle('on',s.id==='v-'+v)});
  try{history.replaceState(null,'','#'+v+(location.hash.indexOf('/e/')>0&&keep?location.hash.slice(location.hash.indexOf('/e/')):''))}catch(e){}
  VIEWS[v]();
}
function rerender(){if(VIEWS[view])VIEWS[view]()}

/* ---------- HOY ---------- */
VIEWS.hoy=async function(){
  var el=$('#v-hoy'),t=today();
  var h=new Date().getHours(),hi=h<12?'Buen día':h<20?'Buenas tardes':'Buenas noches';
  el.innerHTML='<div class="vh"><div><p class="px-eb">'+esc(new Date().toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'}))+'</p><h1>'+hi+', <em>esto es lo de hoy</em></h1><p>Lo que nos toca, los seguimientos vencidos y lo que viene. Las tareas son recordatorios: nada se envía solo.</p></div></div><div class="empty">Cargando…</div>';
  var T='crm_v_tareas',V='crm_v_conversaciones';
  var rs=await Promise.all([
    q(sb.from(V).select('id,empresa_id,empresa,pais,etapa,atencion,ultima_respuesta,ultimo_texto,proxima_accion,proxima_fecha,responsable',{count:'exact'}).eq('atencion','nos_toca_responder').lt('prioridad',9).order('ultima_respuesta',{ascending:false,nullsFirst:false}).limit(40)),
    q(sb.from(T).select('id,empresa_id,empresa,accion,fecha,responsable,origen',{count:'exact'}).eq('estado','pendiente').lt('fecha',t).order('fecha').limit(60)),
    q(sb.from(T).select('id,empresa_id,empresa,accion,fecha,responsable,origen',{count:'exact'}).eq('estado','pendiente').eq('fecha',t).limit(60)),
    q(sb.from(T).select('id,empresa_id,empresa,accion,fecha,responsable,origen',{count:'exact'}).eq('estado','pendiente').gt('fecha',t).lte('fecha',addDays(t,7)).order('fecha').limit(60)),
    q(sb.from(V).select('id,empresa_id,empresa,proxima_accion,proxima_fecha,ultima_respuesta',{count:'exact'}).eq('atencion','esperando_derivacion').lt('prioridad',9).limit(30)),
    q(sb.from(T).select('id',{count:'exact',head:true}).eq('estado','pendiente').is('fecha',null))
  ]);
  var toca=rs[0],venc=rs[1],hoy=rs[2],prox=rs[3],der=rs[4],sinf=rs[5];
  function trow(x){return '<button class="row" data-emp="'+x.empresa_id+'">'+av(x.empresa)+'<div><b>'+esc(x.empresa)+'</b><small>'+esc(x.accion)+' · '+(x.responsable?esc(x.responsable):'Sin asignar')+'</small></div>'+dchip(x.fecha)+'</button>'}
  var html=el.querySelector('.vh').outerHTML+'<div class="kpis">'+
    kpi('Nos toca responder',toca.count,'conversaciones que esperan respuesta nuestra',toca.count?'bad':'','conversaciones')+
    kpi('Vencidos',venc.count,'seguimientos con fecha pasada',venc.count?'warn':'')+
    kpi('Para hoy',hoy.count,'seguimientos del día',hoy.count?'s':'')+
    kpi('Próximos 7 días',prox.count,'seguimientos programados','')+
    kpi('En derivación',der.count,'lo pasaron a otra persona','')+
    kpi('Sin fecha',sinf.count,'seguimientos a programar',sinf.count?'warn':'')+'</div>';
  html+='<div class="grid2"><div class="stack">'+
    box('Nos toca responder',toca.count,toca.data.map(function(c){return '<button class="row" data-emp="'+c.empresa_id+'">'+av(c.empresa,'#FF6B7A')+'<div><b>'+esc(c.empresa)+'</b><small>'+(c.ultima_respuesta?'Respondió '+esc(fdt(c.ultima_respuesta)):'Respuesta sin fecha verificada')+(c.ultimo_texto?' · '+esc(strip(c.ultimo_texto).slice(0,90)):'')+'</small></div>'+atenc(c.atencion)+'</button>'}).join(''),'No hay respuestas pendientes de nuestra parte.')+
    box('Seguimientos vencidos',venc.count,venc.data.map(trow).join(''),'No hay seguimientos vencidos.')+
    '</div><div class="stack">'+
    box('Para hoy',hoy.count,hoy.data.map(trow).join(''),'Nada programado para hoy.')+
    box('Próximos 7 días',prox.count,prox.data.map(trow).join(''),'Nada programado en la semana.')+
    (der.count?box('Esperando derivación interna',der.count,der.data.map(function(c){return '<button class="row" data-emp="'+c.empresa_id+'">'+av(c.empresa,'#B79CFF')+'<div><b>'+esc(c.empresa)+'</b><small>'+esc(c.proxima_accion||'Sin próximo paso')+'</small></div>'+dchip(c.proxima_fecha)+'</button>'}).join(''),''):'')+
    '</div></div>';
  el.innerHTML=html;
};
function kpi(k,v,d,cl,go){return '<div class="kpi '+(cl||'')+'"'+(go?' data-go="'+go+'"':'')+'><div class="k">'+esc(k)+'</div><div class="v">'+(v==null?'—':v)+'</div><div class="d">'+esc(d)+'</div></div>'}
function box(t,n,rows,empty){return '<div class="card"><h3>'+esc(t)+' <span class="cnt" style="background:rgba(0,200,255,.14);color:var(--s)">'+(n||0)+'</span></h3><div class="rows">'+(rows||'<div class="empty">'+esc(empty)+'</div>')+'</div>'+(n>40?'<p class="faint" style="margin:10px 2px 0">Se muestran las primeras. Ver todas en Conversaciones o en cada ficha.</p>':'')+'</div>'}

/* ---------- celdas comunes: último mensaje nuestro / última respuesta / próxima acción ---------- */
function cOut(r){if(r.ultimo_saliente)return '<span class="dt">'+esc(fdt(r.ultimo_saliente))+'</span>';if(r.sin_desglosar)return '<span class="nd">Actividad sin desglosar; consultar historial</span>';if(r.saliente_sin_fecha)return sv('Sin verificar');return '<span class="muted">Sin envíos registrados</span>'}
function cIn(r){if(r.ultima_respuesta)return '<span class="dt">'+esc(fdt(r.ultima_respuesta))+'</span>';if(r.sin_desglosar)return '<span class="nd">Actividad sin desglosar; consultar historial</span>';if(r.respuesta_sin_fecha)return sv('Sin verificar');return '<span class="muted">Sin respuesta registrada</span>'}
function cNext(r){if(!r.proxima_accion&&!r.proxima_fecha)return '<span class="muted">Sin próxima acción</span>';return '<div class="w" title="'+esc(r.proxima_accion||'Seguimiento')+'">'+esc(r.proxima_accion||'Seguimiento')+'</div>'+dchip(r.proxima_fecha)+(r.responsable_accion||r.responsable?' <span class="faint">· '+esc(r.responsable_accion||r.responsable)+'</span>':'')}

/* ---------- CONVERSACIONES ---------- */
var CF={q:'',atencion:'',etapa:'',canal:'',cerradas:false,page:0};
VIEWS.conversaciones=async function(){
  var el=$('#v-conversaciones');
  var head='<div class="vh"><div><p class="px-eb">Intercambios activos</p><h1>Conversaciones</h1><p>Ordenadas por la atención que necesitan: primero lo que nos toca, después los seguimientos vencidos.</p></div></div>'+
    '<div class="filters"><input class="in q" id="cq" placeholder="Buscar empresa" value="'+esc(CF.q)+'">'+
    '<select class="in" id="cat">'+opts(ATENCION,CF.atencion,'Toda atención')+'</select>'+
    '<select class="in" id="cet">'+opts(ETAPAS.filter(function(e){return e[0]!=='sin_contactar'}),CF.etapa,'Toda etapa')+'</select>'+
    '<select class="in" id="cca">'+opts(CANALES.map(function(c){return [c,c]}),CF.canal,'Todo canal')+'</select>'+
    '<label class="tog"><input type="checkbox" id="ccl"'+(CF.cerradas?' checked':'')+'> Incluir cerradas</label></div>';
  el.innerHTML=head+'<div class="empty">Cargando…</div>';
  var b=sb.from('crm_v_conversaciones').select('id,empresa_id,empresa,pais,rubro,canal,etapa,atencion,contactos,ultimo_saliente,ultima_respuesta,proxima_accion,proxima_fecha,responsable,no_contactar,error_canal,prioridad',{count:'exact'});
  if(CF.q)b=b.ilike('empresa',qs(CF.q));if(CF.atencion)b=b.eq('atencion',CF.atencion);if(CF.etapa)b=b.eq('etapa',CF.etapa);if(CF.canal)b=b.eq('canal',CF.canal);
  if(!CF.cerradas)b=b.lt('prioridad',9);
  var r=await q(b.order('prioridad').order('proxima_fecha',{nullsFirst:false}).order('ultima_respuesta',{ascending:false,nullsFirst:false}).range(CF.page*PAGE,CF.page*PAGE+PAGE-1));
  el.innerHTML=head+table(['Empresa','Etapa','Atención','Último mensaje nuestro','Última respuesta del prospecto','Próxima acción'],r.data.map(function(c){
    return '<tr data-emp="'+c.empresa_id+'"><td><b>'+esc(c.empresa)+'</b>'+flags(c)+'<div class="faint">'+esc(uniq([c.contactos,c.canal,c.pais]).join(' · '))+'</div></td><td>'+etapa(c.etapa)+'</td><td>'+atenc(c.atencion)+'</td><td>'+cOut(c)+'</td><td>'+cIn(c)+'</td><td>'+cNext(c)+'</td></tr>'}),'No hay conversaciones con esos filtros.')+pager(r.count,CF,'conv');
  bindF('#cq','q',CF);bindF('#cat','atencion',CF);bindF('#cet','etapa',CF);bindF('#cca','canal',CF);bindF('#ccl','cerradas',CF);
};
function flags(r){return (r.no_contactar?' <span class="chip flag">No contactar</span>':'')+(r.error_canal?' <span class="chip warnf">Error de canal</span>':'')}
function table(h,rows,empty){rows=rows.map(function(r){var i=0;return r.replace(/<td(?=[\s>])/g,function(){return '<td data-l="'+esc(h[i++]||'')+'"'})});return '<div class="tblw"><table class="tbl"><thead><tr>'+h.map(function(x){return '<th>'+esc(x)+'</th>'}).join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>'+(rows.length?'':'<div class="empty" style="margin:14px">'+esc(empty)+'</div>')+'</div>'}
function pager(total,st,key){var from=st.page*PAGE+1,to=Math.min(total,(st.page+1)*PAGE);
  return '<div class="pager"><span>'+(total?from+'–'+to+' de '+total:'0 resultados')+'</span><span><button class="px-btn g xs" data-pg="'+key+'" data-d="-1"'+(st.page?'':' disabled')+'>Anterior</button> <button class="px-btn g xs" data-pg="'+key+'" data-d="1"'+(to<total?'':' disabled')+'>Siguiente</button></span></div>'}
var debT=null;
function bindF(sel,key,st){var e=$(sel);if(!e)return;var fn=function(){st[key]=e.type==='checkbox'?e.checked:e.value;st.page=0;rerender()};
  if(e.tagName==='INPUT'&&e.type!=='checkbox')e.addEventListener('input',function(){clearTimeout(debT);debT=setTimeout(function(){fn();setTimeout(function(){var x=$(sel);if(x){x.focus();x.setSelectionRange(x.value.length,x.value.length)}},60)},350)});
  else e.addEventListener('change',fn)}

/* ---------- PIPELINE ---------- */
VIEWS.pipeline=async function(){
  var el=$('#v-pipeline');
  el.innerHTML='<div class="vh"><div><p class="px-eb">Oportunidades por etapa</p><h1>Pipeline</h1><p>La etapa se cambia desde la ficha, con evidencia. Aceptar ejemplos o dar un correo no es aceptar una propuesta.</p></div></div><div class="empty">Cargando…</div>';
  var st=ETAPAS.filter(function(e){return e[0]!=='sin_contactar'});
  var rs=await Promise.all(st.map(function(e){return q(sb.from('crm_v_conversaciones').select('id,empresa_id,empresa,contactos,atencion,proxima_fecha,valor,moneda,no_contactar,error_canal',{count:'exact'}).eq('etapa',e[0]).order('prioridad').order('proxima_fecha',{nullsFirst:false}).limit(40))}));
  var sc=await q(sb.from('crm_v_empresas').select('id',{count:'exact',head:true}).eq('etapa','sin_contactar'));
  el.innerHTML=el.querySelector('.vh').outerHTML+'<div class="board">'+
    '<div class="col" style="--c:#8C96A8"><div class="col-h"><b>Sin contactar</b><span>'+sc.count+'</span></div><div class="empty">'+sc.count+' empresas sin contacto registrado.<br><button class="px-btn g xs" style="margin-top:10px" data-goemp="sin_contactar">Ver en Empresas</button></div></div>'+
    st.map(function(e,i){var r=rs[i];return '<div class="col" style="--c:'+e[2]+'"><div class="col-h"><b>'+esc(e[1])+'</b><span>'+r.count+'</span></div>'+
      r.data.map(function(c){return '<button class="cc" data-emp="'+c.empresa_id+'"><b>'+esc(c.empresa)+'</b><small>'+esc(c.contactos||'Sin contacto identificado')+'</small><div class="meta">'+atenc(c.atencion)+(c.proxima_fecha?dchip(c.proxima_fecha):'')+(c.valor?'<span class="chip plain">'+esc((c.moneda||'USD')+' '+Number(c.valor).toLocaleString('es-UY'))+'</span>':'')+(c.no_contactar?'<span class="chip flag">No contactar</span>':'')+(c.error_canal?'<span class="chip warnf">Error de canal</span>':'')+'</div></button>'}).join('')+
      (r.count>40?'<button class="px-btn g xs" data-goconv="'+e[0]+'">Ver las '+r.count+'</button>':'')+(r.count?'':'<div class="faint" style="padding:8px">Vacío</div>')+'</div>'}).join('')+'</div>';
};

/* ---------- EMPRESAS ---------- */
var EF={q:'',nicho:'',etapa:'',atencion:'',origen:'',pais:'',nc:false,ec:false,nd:false,rv:false,orden:'atencion',page:0},ORIGENES=null;
VIEWS.empresas=async function(){
  var el=$('#v-empresas');
  if(!ORIGENES){var o=await q(sb.from('crm_empresas').select('origen,pais,nicho').limit(20000));var so={},sp={},sn={};o.data.forEach(function(x){if(x.origen)so[x.origen]=1;if(x.pais)sp[x.pais]=1;if(x.nicho)sn[x.nicho]=1});ORIGENES={o:Object.keys(so).sort(),p:Object.keys(sp).sort(),n:Object.keys(sn).sort()}}
  var head='<div class="vh"><div><p class="px-eb">Directorio</p><h1>Empresas</h1><p>Todas las empresas, con fuentes, etapa y atención. La fecha de importación nunca cuenta como contacto.</p></div></div>'+
    '<div class="filters"><input class="in q" id="eq" placeholder="Buscar por empresa, contacto, email, teléfono o ciudad" value="'+esc(EF.q)+'">'+
    '<select class="in" id="eni">'+opts(ORIGENES.n.map(function(x){return [x,x]}),EF.nicho,'Todo nicho')+'</select>'+
    '<select class="in" id="eet">'+opts(ETAPAS,EF.etapa,'Toda etapa')+'</select>'+
    '<select class="in" id="eat">'+opts(ATENCION,EF.atencion,'Toda atención')+'</select>'+
    '<select class="in" id="eor">'+opts(ORIGENES.o.map(function(x){return [x,x]}),EF.origen,'Todo origen')+'</select>'+
    '<select class="in" id="epa">'+opts(ORIGENES.p.map(function(x){return [x,x]}),EF.pais,'Todo país')+'</select>'+
    '<select class="in" id="eord">'+opts([['atencion','Orden: próxima acción'],['out','Orden: último mensaje nuestro'],['in','Orden: última respuesta'],['nombre','Orden: nombre']],EF.orden)+'</select>'+
    '<label class="tog"><input type="checkbox" id="enc"'+(EF.nc?' checked':'')+'> No contactar</label>'+
    '<label class="tog"><input type="checkbox" id="eec"'+(EF.ec?' checked':'')+'> Error de canal</label>'+
    '<label class="tog"><input type="checkbox" id="end"'+(EF.nd?' checked':'')+'> Sin desglosar</label>'+
    '<label class="tog"><input type="checkbox" id="erv"'+(EF.rv?' checked':'')+'> Con revisión</label></div>';
  el.innerHTML=head+'<div class="empty">Cargando…</div>';
  var b=sb.from('crm_v_empresas').select('id,nombre,rubro,nicho,ciudad,pais,origen,bases,etapa,atencion,ultimo_saliente,saliente_sin_fecha,ultima_respuesta,respuesta_sin_fecha,sin_desglosar,proxima_accion,proxima_fecha,responsable_accion,no_contactar,error_canal,n_revision,n_contactos',{count:'exact'});
  if(EF.q)b=b.ilike('busqueda',qs(EF.q));if(EF.nicho)b=b.eq('nicho',EF.nicho);if(EF.etapa)b=b.eq('etapa',EF.etapa);if(EF.atencion)b=b.eq('atencion',EF.atencion);if(EF.origen)b=b.eq('origen',EF.origen);if(EF.pais)b=b.eq('pais',EF.pais);
  if(EF.nc)b=b.eq('no_contactar',true);if(EF.ec)b=b.eq('error_canal',true);if(EF.nd)b=b.eq('sin_desglosar',true);if(EF.rv)b=b.gt('n_revision',0);
  b=EF.orden==='out'?b.order('ultimo_saliente',{ascending:false,nullsFirst:false}):EF.orden==='in'?b.order('ultima_respuesta',{ascending:false,nullsFirst:false}):EF.orden==='nombre'?b.order('nombre'):b.order('proxima_fecha',{nullsFirst:false}).order('ultima_respuesta',{ascending:false,nullsFirst:false});
  var r=await q(b.order('nombre').range(EF.page*PAGE,EF.page*PAGE+PAGE-1));
  el.innerHTML=head+table(['Empresa','Etapa','Atención','Último mensaje nuestro','Última respuesta del prospecto','Próxima acción'],r.data.map(function(c){
    return '<tr data-emp="'+c.id+'"><td><b>'+esc(c.nombre)+'</b>'+flags(c)+(c.n_revision?' <span class="chip warnf" title="Ítems para revisar">'+c.n_revision+' a revisar</span>':'')+'<div class="faint">'+(c.nicho?'<span style="color:var(--sl)">'+esc(c.nicho)+'</span> · ':'')+esc(uniq([c.rubro,c.ciudad,c.pais],[c.nicho]).join(' · ')||'')+'</div><div class="faint">'+esc((c.bases||[]).filter(function(x){return x}).join(' + '))+'</div></td><td>'+etapa(c.etapa)+'</td><td>'+(c.etapa==='sin_contactar'?'<span class="muted">—</span>':atenc(c.atencion))+'</td><td>'+cOut(c)+'</td><td>'+cIn(c)+'</td><td>'+cNext(c)+'</td></tr>'}),'Ninguna empresa coincide con los filtros.')+pager(r.count,EF,'emp');
  bindF('#eq','q',EF);bindF('#eni','nicho',EF);bindF('#eet','etapa',EF);bindF('#eat','atencion',EF);bindF('#eor','origen',EF);bindF('#epa','pais',EF);bindF('#eord','orden',EF);
  bindF('#enc','nc',EF);bindF('#eec','ec',EF);bindF('#end','nd',EF);bindF('#erv','rv',EF);
};

/* ---------- NICHOS ---------- */
// Evaluación con reglas explícitas. La tasa usa la misma ventana para todos los nichos y un intervalo de Wilson al 95 %:
// solo se dice "mejor" o "peor" que el promedio si el intervalo no lo incluye, y nunca con menos de 30 envíos observados.
var NV=3,NDATA=null,MIN_N=30;
function wilson(k,n){if(!n)return [0,0];var z=1.96,p=k/n,d=1+z*z/n,c=p+z*z/(2*n),m=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return [Math.max(0,(c-m)/d),Math.min(1,(c+m)/d)]}
function pct(x){return (Math.round(x*1000)/10).toLocaleString('es-UY')+' %'}
function evalNicho(x,p0){
  if(!x.observados)return {t:'Sin envíos medibles',c:'',k:'none'};
  if(x.observados<MIN_N)return {t:'Muestra chica',c:'warnf',k:'wait'};
  var w=wilson(x.respondieron_en_ventana,x.observados);
  if(w[0]>p0)return {t:'Responde por encima del promedio',c:'',k:'up',col:'#4BE39A'};
  if(w[1]<p0)return {t:'Responde por debajo del promedio',c:'flag',k:'down'};
  return {t:'Sin diferencia clara',c:'',k:'eq',col:'#9FB3FF'};
}
function conclusiones(x,p0,V){
  var L=[],ev=evalNicho(x,p0),rate=x.observados?x.respondieron_en_ventana/x.observados:0,w=wilson(x.respondieron_en_ventana,x.observados);
  if(!x.contactadas)L.push(['wait','Todavía no se contactó a ninguna empresa de este nicho.','Hay '+x.empresas+' empresas cargadas.']);
  else if(!x.observados)L.push(['wait','Los envíos todavía no cumplieron la ventana de '+dias(V)+', o no tienen fecha exacta.','Cuando pasen, se calcula la tasa con la misma regla que el resto.']);
  else if(ev.k==='wait')L.push(['wait','No alcanza para concluir: '+x.observados+' envíos observados (se necesitan al menos '+MIN_N+').',x.respondieron_en_ventana+' respondieron dentro de '+dias(V)+' ('+pct(rate)+'). Seguir midiendo antes de decidir.']);
  else L.push([ev.k==='up'?'up':ev.k==='down'?'down':'',ev.k==='up'?'Responde mejor que el promedio.':ev.k==='down'?'Responde peor que el promedio.':'No se distingue del promedio.',
    x.respondieron_en_ventana+' de '+x.observados+' envíos respondieron dentro de '+dias(V)+': '+pct(rate)+' (rango probable '+pct(w[0])+' a '+pct(w[1])+'). Promedio general: '+pct(p0)+'.']);
  var c=x.clasificacion||{},ic=c.interes_concreto||0,co=c.cordial_sin_compromiso||0,de=c.derivacion||0,ne=c.negativa_baja||0,sc=c.sin_clasificar||0,tot=ic+co+de+ne+sc;
  if(tot){var parts=[];if(ic)parts.push(ic+' con interés concreto');if(co)parts.push(co+' cordiales sin compromiso');if(de)parts.push(de+' derivaciones');if(ne)parts.push(ne+' negativas o bajas');if(sc)parts.push(sc+' sin clasificar');
    L.push([ic?'up':'wait',ic?'Hay interés concreto en este nicho.':'Responden, pero todavía sin interés concreto.','Respuestas humanas: '+parts.join(', ')+'. Aceptar ejemplos o decir “lo tendré en cuenta” no es interés concreto.'])}
  if(x.intentos>=10&&x.rebotes/x.intentos>=0.1)L.push(['down','Muchos rebotes: '+pct(x.rebotes/x.intentos)+' de los envíos.','Revisar la calidad de los emails de este nicho antes de la próxima tanda ('+x.rebotes+' de '+x.intentos+').']);
  if(x.sin_desglosar)L.push(['wait',emp(x.sin_desglosar)+' con contacto previo sin detalle.','Figuran como contactadas en el origen pero sin mensajes con fecha: la medición de este nicho está incompleta.']);
  if(x.sin_contactar)L.push(['',x.sin_contactar+' de '+x.empresas+' empresas siguen sin contactar.','Es el margen que queda para la próxima tanda en este nicho.']);
  var fb=(x.fuente_nicho||{}).base||0;if(fb)L.push(['wait',(fb===1?'El nicho de 1 empresa se asignó':'El nicho de '+fb+' empresas se asignó')+' por la base de origen.','Conviene confirmarlo en la ficha si se va a usar para decidir.']);
  var vs=(x.variantes||[]).filter(function(v){return v.variante!=='Sin variante'});
  if(vs.length>1){var chicas=vs.every(function(v){return v.n<MIN_N});L.push([chicas?'wait':'',chicas?'Variantes con pocos envíos: no comparar todavía.':'Comparación de variantes disponible.',vs.map(function(v){return v.variante+': '+v.respondieron+'/'+v.n}).join(' · ')])}
  return L;
}
VIEWS.nichos=async function(){
  var el=$('#v-nichos');
  el.innerHTML='<div class="vh"><div><p class="px-eb">Categorías de prospectos</p><h1>Nichos</h1><p>Cuántas empresas hay por nicho, cuántas se contactaron, cuántas respondieron y qué se puede concluir con la evidencia que hay.</p></div><label class="f"><span>Ventana de observación</span><select class="in" id="nven">'+opts([['1','1 día'],['3','3 días'],['7','7 días'],['14','14 días']],String(NV))+'</select></label></div><div class="empty">Calculando…</div>';
  $('#nven').onchange=function(){NV=+this.value;VIEWS.nichos()};
  var d=(await q(sb.rpc('crm_nichos',{p_ventana_dias:NV}))).data;NDATA=d;
  var N=d.nichos,so=N.reduce(function(s,x){return s+x.observados},0),sr=N.reduce(function(s,x){return s+x.respondieron_en_ventana},0),p0=so?sr/so:0;
  var medibles=N.filter(function(x){return x.observados>=MIN_N}).sort(function(a,b){return b.respondieron_en_ventana/b.observados-a.respondieron_en_ventana/a.observados});
  var gen=[];
  if(!so)gen.push(['wait','Todavía no hay envíos con la ventana completa.','No se puede comparar nichos por tasa de respuesta.']);
  else if(!medibles.length)gen.push(['wait','Ningún nicho llega a '+MIN_N+' envíos observados. Por ahora no se puede decir cuál responde mejor.','Total observado: '+so+' envíos, '+sr+' respondieron dentro de '+dias(NV)+' ('+pct(p0)+'). Seguir midiendo con ventanas iguales.']);
  else{medibles.forEach(function(x){var e=evalNicho(x,p0);if(e.k==='up'||e.k==='down')gen.push([e.k,x.nicho+': '+e.t.toLowerCase()+'.',x.respondieron_en_ventana+'/'+x.observados+' ('+pct(x.respondieron_en_ventana/x.observados)+') contra '+pct(p0)+' de promedio.'])});
    if(!gen.length)gen.push(['','Los nichos medibles no se diferencian del promedio ('+pct(p0)+').','Con los datos actuales ninguno responde claramente mejor o peor.'])}
  var masResp=N.filter(function(x){return x.respondieron}).sort(function(a,b){return b.respondieron-a.respondieron})[0];
  if(masResp)gen.push(['','Más respuestas en números absolutos: '+masResp.nicho+' ('+emp(masResp.respondieron)+').','Ojo: más respuestas también puede ser más envíos. Para comparar, mirá la tasa en la ventana.']);
  var nocon=N.filter(function(x){return !x.contactadas&&x.empresas>=20}).map(function(x){return x.nicho+' ('+x.empresas+')'});
  if(nocon.length)gen.push(['','Nichos cargados sin ningún envío registrado: '+nocon.join(', ')+'.','Puede ser que nunca se contactaron o que el contacto está sin desglosar en el historial.']);
  el.innerHTML=el.querySelector('.vh').outerHTML+
    '<div class="kpis">'+kpi('Nichos',N.length,'categorías con empresas','s')+kpi('Envíos observados',so,'con '+dias(NV)+' de observación','')+kpi('Respondieron',sr,'dentro de la ventana',sr?'ok':'')+kpi('Promedio general',so?pct(p0):'—','tasa de respuesta','')+'</div>'+
    '<div class="card" style="margin-bottom:16px"><h3>Conclusiones generales</h3><ul class="concl">'+gen.map(function(c){return '<li class="'+c[0]+'"><b>'+esc(c[1])+'</b><small>'+esc(c[2])+'</small></li>'}).join('')+'</ul></div>'+
    table(['Nicho','Empresas','Contactadas','Intentos','Rebotes','Respondieron','Tasa en la ventana','Evaluación'],N.map(function(x){var e=evalNicho(x,p0);
      return '<tr data-nicho="'+esc(x.nicho)+'" style="cursor:pointer"><td><b>'+esc(x.nicho)+'</b>'+(x.sin_desglosar?'<div class="faint">'+x.sin_desglosar+' sin desglosar</div>':'')+'</td><td class="num">'+x.empresas+'</td><td class="num">'+x.contactadas+'</td><td class="num">'+x.intentos+(x.reposiciones?'<div class="faint">'+x.reposiciones+' repos.</div>':'')+'</td><td class="num"'+(x.rebotes?' style="color:var(--warn)"':'')+'>'+x.rebotes+'</td><td class="num"'+(x.respondieron?' style="color:var(--ok)"':'')+'>'+x.respondieron+'</td><td class="num">'+(x.observados?pct(x.respondieron_en_ventana/x.observados)+'<div class="faint">'+x.respondieron_en_ventana+' de '+x.observados+'</div>':'<span class="muted">—</span>')+'</td><td><span class="chip '+e.c+'"'+(e.col?' style="--c:'+e.col+'"':'')+'>'+esc(e.t)+'</span></td></tr>'}),'No hay nichos.')+
    '<p class="faint" style="margin-top:10px">Tocá un nicho para ver el detalle. Regla: se compara solo con ventanas iguales, con al menos '+MIN_N+' envíos observados, y se dice “mejor” o “peor” solo si la diferencia con el promedio es clara.</p>';
};
function verNicho(n){
  var x=(NDATA&&NDATA.nichos||[]).find(function(y){return y.nicho===n});if(!x)return;
  var N=NDATA.nichos,so=N.reduce(function(s,y){return s+y.observados},0),sr=N.reduce(function(s,y){return s+y.respondieron_en_ventana},0),p0=so?sr/so:0,V=NDATA.ventana_dias;
  var et=x.etapas||{},tot=Object.keys(et).reduce(function(s,k){return s+et[k]},0)||1;
  modal('<p class="px-eb">Nicho</p><h3 style="font-size:22px">'+esc(x.nicho)+'</h3><p class="faint">'+(x.primer_envio?'Envíos entre '+esc(fd(x.primer_envio))+' y '+esc(fd(x.ultimo_envio)):'Sin envíos con fecha')+'</p>'+
    '<div class="kpis mini" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr))">'+kpi('Empresas',x.empresas,'en la base','s')+kpi('Contactadas',x.contactadas,'con envío','')+kpi('Intentos',x.intentos,x.reposiciones+' reposiciones','')+kpi('Rebotes',x.rebotes,'envíos',x.rebotes?'warn':'')+kpi('Respondieron',x.respondieron,'empresas',x.respondieron?'ok':'')+'</div>'+
    '<div class="sec">Qué se puede concluir</div><ul class="concl">'+conclusiones(x,p0,V).map(function(c){return '<li class="'+c[0]+'"><b>'+esc(c[1])+'</b><small>'+esc(c[2])+'</small></li>'}).join('')+'</ul>'+
    '<div class="sec">Empresas por etapa</div>'+ETAPAS.filter(function(e){return et[e[0]]}).map(function(e){return '<div class="dist"><span>'+esc(e[1])+'</span><span class="bar"><i style="width:'+(et[e[0]]/tot*100)+'%;background:'+e[2]+'"></i></span><span class="num">'+et[e[0]]+'</span></div>'}).join('')+
    ((x.variantes||[]).length?'<div class="sec">Variantes de mensaje</div>'+table(['Variante','Envíos','Con respuesta posterior'],x.variantes.map(function(v){return '<tr><td>'+esc(v.variante)+'</td><td class="num">'+v.n+'</td><td class="num">'+v.respondieron+'</td></tr>'}),''):'')+
    '<div class="acts"><button class="px-btn p sm" data-gonicho="'+esc(x.nicho)+'">Ver las '+x.empresas+' empresas</button><button class="px-btn g sm" data-close>Cerrar</button></div>');
}

/* ---------- TANDAS ---------- */
VIEWS.tandas=async function(){
  var el=$('#v-tandas');
  el.innerHTML='<div class="vh"><div><p class="px-eb">Resultados de prospección</p><h1>Tandas</h1><p>Contactos únicos, intentos y reposiciones separados. Una reposición es un envío a otra empresa o casilla para reemplazar un rebote.</p></div></div><div class="empty">Cargando…</div>';
  var r=await q(sb.from('crm_v_tandas').select('*').order('fecha',{ascending:false,nullsFirst:false}));
  el.innerHTML=el.querySelector('.vh').outerHTML+(r.data.length?'<div class="grid3">'+r.data.map(function(t){
    var dist=t.distribucion||{},tot=Object.keys(dist).reduce(function(s,k){return s+dist[k]},0)||1;
    return '<div class="card"><p class="px-eb">'+esc(fd(t.fecha)||'Fecha sin verificar')+' · '+esc(t.canal||'Canal sin dato')+'</p><h3 style="font-size:18px;margin-bottom:2px">'+esc(t.nombre)+'</h3>'+(t.nombre_origen&&t.nombre_origen!==t.nombre?'<p class="faint" style="margin:0">En el origen: <span class="mono">'+esc(t.nombre_origen)+'</span></p>':'')+
      '<div class="sec">Alcance</div><div class="kpis mini">'+kpi('Únicos',t.contactos_unicos,'personas o empresas','s')+kpi('Envíos',t.intentos,'intentos totales','')+kpi('Reposiciones',t.reposiciones,'reemplazos de rebotes','')+'</div>'+
      '<div class="sec">Resultado</div><div class="kpis mini">'+kpi('Sin rebote',t.sin_error,'hasta el último control','')+kpi('Rebotes',t.rebotes,'emails que no llegaron',t.rebotes?'warn':'')+kpi('Respondieron',t.respondieron,'empresas',t.respondieron?'ok':'')+'</div>'+
      '<div class="sec">Por nicho</div>'+Object.keys(dist).sort(function(a,b){return dist[b]-dist[a]}).map(function(k){return '<div class="dist"><span title="'+esc(k)+'">'+esc(k)+'</span><span class="bar"><i style="width:'+(dist[k]/tot*100)+'%"></i></span><span class="num">'+dist[k]+'</span></div>'}).join('')+
      ((t.variantes||[]).length?'<div class="sec">Variantes</div><div class="f-flags">'+t.variantes.map(function(v){return '<span class="chip plain">'+esc(v)+'</span>'}).join('')+'</div>':'')+
      (t.responsable?'<p class="faint" style="margin:10px 0 0">Responsable: '+esc(t.responsable)+'</p>':'')+
      '<div class="acts"><button class="px-btn g xs" data-tanda="'+t.id+'" data-tn="'+esc(t.nombre)+'">Ver participantes</button></div></div>'}).join('')+'</div>':'<div class="empty">Todavía no hay tandas registradas.</div>');
};
async function verTanda(id,nombre){
  var r=await q(sb.from('crm_tanda_participantes').select('intento,es_reposicion,reemplaza,resultado,variante,nicho,empresa_id,crm_empresas(nombre),crm_contactos(nombre,email)').eq('tanda_id',id).order('creado_en'));
  modal('<h3 style="font-size:18px">'+esc(nombre)+'</h3><p class="faint">'+r.data.length+' envíos</p>'+table(['Empresa','Contacto','Variante','Intento','Resultado'],r.data.map(function(p){
    return '<tr data-emp="'+p.empresa_id+'"><td><b>'+esc(p.crm_empresas&&p.crm_empresas.nombre)+'</b><div class="faint">'+esc(p.nicho||'')+'</div></td><td>'+esc(p.crm_contactos?(p.crm_contactos.nombre||'')+' '+(p.crm_contactos.email||''):'Sin contacto')+'</td><td>'+esc(p.variante||'—')+'</td><td>'+p.intento+(p.es_reposicion?' <span class="chip warnf">Reposición</span>'+(p.reemplaza?'<div class="faint">Reemplaza: '+esc(p.reemplaza)+'</div>':''):'')+'</td><td>'+esc(ENVIO[p.resultado]||p.resultado||'Sin dato')+'</td></tr>'}),'Sin participantes.')+'<div class="acts"><button class="px-btn g sm" data-close>Cerrar</button></div>');
}

/* ---------- MÉTRICAS ---------- */
var ventana=3;
VIEWS.metricas=async function(){
  var el=$('#v-metricas');
  el.innerHTML='<div class="vh"><div><p class="px-eb">Medición</p><h1>Métricas</h1><p>Solo cuentan actividades con prospectos; los registros administrativos quedan afuera.</p></div><label class="f"><span>Ventana de observación</span><select class="in" id="mven">'+opts([['1','1 día'],['3','3 días'],['7','7 días'],['14','14 días']],String(ventana))+'</select></label></div><div class="empty">Calculando…</div>';
  $('#mven').onchange=function(){ventana=+this.value;VIEWS.metricas()};
  var m=(await q(sb.rpc('crm_metricas',{p_ventana_dias:ventana}))).data;
  function bars(o,labels){var ks=Object.keys(o||{}),tot=ks.reduce(function(s,k){return s+o[k]},0)||1;return ks.sort(function(a,b){return o[b]-o[a]}).map(function(k){return '<div style="display:grid;grid-template-columns:200px 1fr 40px;gap:10px;align-items:center;margin-bottom:6px;font-size:13px"><span>'+esc((labels&&labels[k]&&labels[k].n)||(labels&&typeof labels[k]==='string'&&labels[k])||k.replace(/_/g,' ').replace(/^./,function(m){return m.toUpperCase()}))+'</span><span class="bar"><i style="width:'+(o[k]/tot*100)+'%"></i></span><span class="mono">'+o[k]+'</span></div>'}).join('')||'<div class="faint">Sin datos</div>'}
  function cmp(list,t){return '<div class="card"><h3>'+esc(t)+'</h3>'+table(['Grupo','Envíos observados','Respondieron','Tasa'],(list||[]).map(function(g){return '<tr><td>'+esc(String(g.grupo).replace(/^\d+\s·\s/,''))+'</td><td class="mono">'+g.n+'</td><td class="mono">'+g.respondieron+'</td><td class="mono">'+(g.n?Math.round(g.respondieron/g.n*1000)/10+' %':'—')+(g.muestra_chica?'<div style="margin-top:4px"><span class="chip warnf">Muestra chica</span></div>':'')+'</td></tr>'}),'Todavía no hay envíos con la ventana completa.')+'<p class="faint" style="margin:10px 2px 0">Cada envío se observa durante '+dias(m.ventana_dias)+' desde que salió; los que todavía no cumplieron la ventana no cuentan. Con menos de 30 envíos por grupo no se declara ganador.</p></div>'}
  el.innerHTML=el.querySelector('.vh').outerHTML+'<div class="kpis k4">'+
    kpi('Contactos únicos',m.contactos_unicos,'personas o empresas distintas','s')+kpi('Intentos',m.intentos,'mensajes enviados','')+kpi('Reposiciones',m.reposiciones,'envíos de reemplazo','')+
    kpi('Empresas contactadas',m.empresas_contactadas,'de '+m.empresas+' en la base','')+kpi('Respondieron',m.empresas_que_respondieron,m.respuestas_humanas+' respuestas humanas',m.empresas_que_respondieron?'ok':'')+
    kpi('Rebotes',m.rebotes,'no marcan la oportunidad como perdida',m.rebotes?'warn':'')+kpi('Automáticas',m.respuestas_automaticas,'respuestas automáticas','')+kpi('Sin desglosar',m.sin_desglosar,'con contacto previo sin detalle','')+'</div>'+
    '<div class="grid2"><div class="card"><h3>Estado de los envíos</h3>'+bars(m.estado_envio,ENVIO)+'</div><div class="card"><h3>Respuestas humanas</h3>'+bars(m.clasificacion,Object.assign({sin_clasificar:'Sin clasificar'},CLASIF))+'<p class="faint">Primeras respuestas: '+m.primeras_respuestas+'</p></div>'+
    '<div class="card"><h3>Empresas por etapa</h3>'+bars(m.etapas,EM)+'</div><div class="card"><h3>Conversaciones por atención</h3>'+bars(m.atencion,Object.assign({sin_definir:'Sin definir'},AM))+'</div></div>'+
    '<div class="grid2" style="margin-top:16px">'+cmp(m.por_variante,'Por variante de mensaje')+cmp(m.por_franja,'Por franja horaria (Uruguay)')+'</div>'+
    '<p class="faint" style="margin-top:14px">No contactar: '+m.no_contactar+' · Error de canal: '+m.error_canal+' · Envíos observados con ventana completa: '+m.observados+'</p>';
};

/* ---------- REVISIÓN ---------- */
var RF={tipo:'',page:0,admin:false};
VIEWS.revision=async function(){
  var el=$('#v-revision');
  var cnt=await q(sb.from('crm_revision').select('tipo').eq('estado','abierta').limit(10000));
  var by={};cnt.data.forEach(function(x){by[x.tipo]=(by[x.tipo]||0)+1});
  var head='<div class="vh"><div><p class="px-eb">Calidad de datos</p><h1>Revisión de datos</h1><p>Información incompleta, conflictos y posibles duplicados. Nada se fusiona solo: cada caso lo decide una persona.</p></div></div>'+
    '<div class="filters"><button class="px-btn '+(!RF.tipo&&!RF.admin?'p':'g')+' xs" data-rt="">Todo ('+cnt.data.length+')</button>'+Object.keys(REVT).filter(function(k){return by[k]}).map(function(k){return '<button class="px-btn '+(RF.tipo===k?'p':'g')+' xs" data-rt="'+k+'">'+esc(REVT[k])+' ('+by[k]+')</button>'}).join('')+
    '<button class="px-btn '+(RF.admin?'p':'g')+' xs" data-radmin>Espacio administrativo</button></div>';
  if(RF.admin){
    var ex=await q(sb.from('crm_ejecuciones').select('id,clave,tipo,titulo,fecha,detalle,fuente_url',{count:'exact'}).order('fecha',{ascending:false,nullsFirst:false}).range(RF.page*PAGE,RF.page*PAGE+PAGE-1));
    el.innerHTML=head+'<div class="note" style="margin-bottom:12px">Registros de importación, conciliación, errores y ejecuciones. No son empresas ni mensajes a prospectos y no cuentan en las métricas.</div>'+
      table(['Fecha','Tipo','Registro','Detalle'],ex.data.map(function(x){return '<tr data-ejec="'+x.id+'"><td class="dt">'+(x.fecha?esc(fdt(x.fecha)):sv())+'</td><td>'+esc(x.tipo)+'</td><td><b>'+esc(x.titulo||x.clave)+'</b><div class="faint">'+link(x.fuente_url,'Ver en el origen')+'</div></td><td class="w">'+esc((x.detalle||'').slice(0,180))+'</td></tr>'}),'Sin registros.')+pager(ex.count,RF,'rev');
    return;
  }
  var b=sb.from('crm_revision').select('*',{count:'exact'}).eq('estado','abierta');if(RF.tipo)b=b.eq('tipo',RF.tipo);
  var r=await q(b.order('tipo').order('creado_en',{ascending:false}).range(RF.page*PAGE,RF.page*PAGE+PAGE-1));
  var NM=await revNombres(r.data);
  el.innerHTML=head+(r.data.length?'<div class="rows">'+r.data.map(function(x){
    var a=NM.de(x.entidad,x.entidad_clave,x.datos),o=x.relacionada_clave?NM.de('empresas',x.relacionada_clave):null;
    var dup=x.tipo==='posible_duplicado';
    return '<div class="card rv"><div class="ev-h"><span class="chip warnf">'+esc(REVT[x.tipo]||x.tipo)+'</span><b>'+esc(x.detalle)+'</b></div>'+
      (dup&&a&&o?'<div class="rv-cmp">'+rvBox(a,'Esta')+rvBox(o,'Posible duplicada')+'</div>':
        '<div class="rv-one">'+(a?'<b>'+esc(a.nombre)+'</b>'+rvDet(a):'<span class="sv">Empresa no identificada</span>'+(function(){var z=NM.extra(x.entidad_clave);return z?'<div style="margin-top:6px"><b>'+esc(z.t||'Registro')+'</b>'+(z.f?' <span class="faint">· '+esc(fdt(z.f))+'</span>':'')+(z.d?'<div class="faint" style="margin-top:2px">'+esc(String(z.d).replace(/\s+/g,' ').slice(0,260))+'</div>':'')+'</div>':''})())+(x.relacionada_clave?' <span class="faint">con</span> '+(o?'<b>'+esc(o.nombre)+'</b>'+rvDet(o):'<span class="mono faint">'+esc(x.relacionada_clave)+'</span>'):'')+'</div>')+
      (x.datos&&x.datos.campo?'<div class="ev-f"><span>Campo '+esc(x.datos.campo)+': actual <b>'+esc(JSON.stringify(x.datos.actual))+'</b> · importado <b>'+esc(JSON.stringify(x.datos.importado))+'</b></span></div>':'')+
      '<div class="ev-f"><span>'+esc(fdt(x.creado_en))+'</span><span class="faint mono" title="Identificador del registro de origen">'+esc(x.entidad_clave||'')+'</span></div>'+
      '<div class="acts">'+(a?'<button class="px-btn g xs" data-rvopen="'+x.id+'">Abrir</button>':'')+(x.relacionada_clave?'<button class="px-btn g xs" data-rvopen2="'+x.id+'">Abrir la otra</button>':'')+
      '<button class="px-btn g xs" data-rvres="'+x.id+'" data-st="resuelta">Marcar resuelta</button><button class="px-btn g xs" data-rvres="'+x.id+'" data-st="descartada">Descartar</button></div></div>'}).join('')+'</div>'+pager(r.count,RF,'rev'):'<div class="empty">No hay nada pendiente de revisión con este filtro.</div>');
  RV=r.data;
};
var RV=[];
function telTxt(t){if(!t)return '';t=String(t);if(t.charAt(0)==='{'||t.charAt(0)==='['){try{var o=JSON.parse(t);o=Array.isArray(o)?o[0]:o;return (o&&o.label?o.label:'Enlace')+' (enlace)'}catch(e){}}return t}
function rvDet(e){var d=[e.rubro,e.ciudad,e.web,telTxt(e.telefono)].filter(Boolean);return d.length?' <span class="faint">· '+esc(d.join(' · '))+'</span>':''}
function rvBox(e,t){return '<div class="rv-b"><small>'+esc(t)+'</small><b>'+esc(e.nombre)+'</b><div class="faint">'+esc([e.rubro,e.ciudad].filter(Boolean).join(' · ')||'Rubro y ciudad pendientes')+'</div><div class="faint">'+(e.web?esc(e.web):'Web sin dato')+' · '+(e.telefono?esc(telTxt(e.telefono)):'Teléfono sin dato')+'</div></div>'}
async function revNombres(rows){
  var T={actividades:'crm_actividades',contactos:'crm_contactos',conversaciones:'crm_conversaciones',fuentes:'crm_fuentes',materiales:'crm_materiales',tareas:'crm_tareas'};
  var claves={},porT={};
  rows.forEach(function(x){
    if(x.entidad==='empresas'&&x.entidad_clave)claves[x.entidad_clave]=1;
    else if(T[x.entidad]&&x.entidad_clave)(porT[x.entidad]=porT[x.entidad]||{})[x.entidad_clave]=1;
    if(x.relacionada_clave)claves[x.relacionada_clave]=1;
    if(x.datos&&x.datos.empresa)claves[x.datos.empresa]=1});
  var sel='id,clave,nombre,rubro,ciudad,web,telefono',porClave={},porId={},idDe={};
  var tablas=Object.keys(porT);
  for(var i=0;i<tablas.length;i++){var cl=Object.keys(porT[tablas[i]]);
    var rr=await q(sb.from(T[tablas[i]]).select('clave,empresa_id').in('clave',cl));
    (rr.data||[]).forEach(function(z){idDe[z.clave]=z.empresa_id})}
  var ck=Object.keys(claves);
  if(ck.length){var re=await q(sb.from('crm_empresas').select(sel).in('clave',ck));(re.data||[]).forEach(function(e){porClave[e.clave]=e;porId[e.id]=e})}
  var ids=Object.keys(idDe).map(function(k){return idDe[k]}).filter(function(id){return id&&!porId[id]});
  if(ids.length){var ri=await q(sb.from('crm_empresas').select(sel).in('id',ids));(ri.data||[]).forEach(function(e){porId[e.id]=e})}
  var ex={};
  var ek=rows.filter(function(x){return x.tipo==='sin_empresa'&&x.entidad==='ejecuciones'&&x.entidad_clave}).map(function(x){return x.entidad_clave});
  if(ek.length){var rx=await q(sb.from('crm_ejecuciones').select('clave,titulo,fecha,detalle').in('clave',ek));(rx.data||[]).forEach(function(z){ex[z.clave]={t:z.titulo,f:z.fecha,d:z.detalle}})}
  var fk=rows.filter(function(x){return x.tipo==='sin_empresa'&&x.entidad==='fuentes'&&x.entidad_clave}).map(function(x){return x.entidad_clave});
  if(fk.length){var rf=await q(sb.from('crm_fuentes').select('clave,tabla,texto_original').in('clave',fk));(rf.data||[]).forEach(function(z){ex[z.clave]={t:z.tabla||'Registro de origen',f:null,d:z.texto_original}})}
  return {extra:function(clave){return ex[clave]||null},de:function(entidad,clave,datos){
    if(datos&&datos.empresa&&porClave[datos.empresa])return porClave[datos.empresa];
    if(!clave)return null;
    if(entidad==='empresas'||!T[entidad])return porClave[clave]||null;
    return porId[idDe[clave]]||null}}
}
async function empresaDeClave(entidad,clave,datos){
  if(datos&&datos.empresa)clave=datos.empresa,entidad='empresas';
  if(!clave)return null;
  if(entidad==='empresas'){var r=await q(sb.from('crm_empresas').select('id').eq('clave',clave).maybeSingle());return r.data&&r.data.id}
  var t={actividades:'crm_actividades',contactos:'crm_contactos',conversaciones:'crm_conversaciones',fuentes:'crm_fuentes',materiales:'crm_materiales',tareas:'crm_tareas'}[entidad];
  if(!t){var e2=await q(sb.from('crm_empresas').select('id').eq('clave',clave).maybeSingle());return e2.data&&e2.data.id}
  var r2=await q(sb.from(t).select('empresa_id').eq('clave',clave).maybeSingle());return r2.data&&r2.data.empresa_id;
}
function resolverRev(id,estado){
  modal('<h3 style="font-size:18px">'+(estado==='resuelta'?'Marcar como resuelta':'Descartar')+'</h3><p class="faint">Dejá una nota corta con lo que decidiste. Queda registrada con tu usuario.</p><label class="f full"><span>Nota</span><textarea class="in" id="rvnota" placeholder="Ej.: son dos sucursales distintas"></textarea></label><div class="acts"><button class="px-btn p sm" id="rvok">Guardar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
  $('#rvok').onclick=async function(){await q(sb.from('crm_revision').update({estado:estado,resolucion:$('#rvnota').value||null,resuelto_por:me,resuelto_en:new Date().toISOString()}).eq('id',id));closeModal();toast('Listo');refreshRevCnt();rerender()};
}
async function refreshRevCnt(){try{var r=await sb.from('crm_revision').select('id',{count:'exact',head:true}).eq('estado','abierta');$('#revCnt').textContent=r.count||''}catch(e){}}

/* ---------- FICHA ---------- */
var F=null,ftab='crono',fcanal='',ftipo='';
async function openFicha(id,tab){
  $('#scrim').hidden=false;var f=$('#ficha');f.classList.add('on');f.setAttribute('aria-hidden','false');
  f.innerHTML='<div class="f-body"><div class="empty">Cargando ficha…</div></div>';
  ftab=tab||'crono';fcanal='';ftipo='';
  var r=await q(sb.rpc('crm_ficha',{p_empresa:id}));
  F=r.data;if(!F||!F.empresa){f.innerHTML='<div class="f-body"><div class="empty">No se encontró la empresa.</div></div>';return}
  try{history.replaceState(null,'','#'+view+'/e/'+id)}catch(e){}
  renderFicha();
}
function closeFicha(){var f=$('#ficha');f.classList.remove('on');f.setAttribute('aria-hidden','true');$('#scrim').hidden=true;F=null;try{history.replaceState(null,'','#'+view)}catch(e){}}
function conv(){return F.conversaciones[0]||null}
function cname(id){var c=F.contactos.find(function(x){return x.id===id});return c?(c.nombre||c.email||'Contacto'):''}
function actsSorted(){return F.actividades.slice()}
function resumen(){
  var e=F.empresa,v=F.vista||{},c=conv(),A=actsSorted();
  var ks=c&&c.contactos&&c.contactos.length?F.contactos.filter(function(k){return c.contactos.indexOf(k.id)>=0}):F.contactos;
  var quien=ks.length?ks.slice(0,3).map(function(k){return esc(k.nombre||k.email||'Contacto')+(k.cargo?' · '+esc(k.cargo):'')+' · '+(k.rol_decision?esc(ROLES[k.rol_decision]):'<span class="sv">rol sin verificar</span>')}).join('<br>'):'<span class="sv">Sin contacto identificado</span>';
  var resp=A.filter(function(a){return a.direccion==='entrante'&&a.tipo!=='rebote'&&a.estado_envio!=='respuesta_automatica'}).sort(byFecha)[0];
  var respTxt=resp?(resp.fecha_hecho?esc(fdt(resp.fecha_hecho)):sv('Fecha sin verificar'))+(resp.clasificacion?' · '+esc(CLASIF[resp.clasificacion]):' · <span class="sv">sin clasificar</span>')+(resp.texto?'<div class="faint">“'+esc(strip(resp.texto).slice(0,140))+'”</div>':''):(v.sin_desglosar?'<span class="nd">Actividad sin desglosar; consultar historial</span>':'<span class="muted">Sin respuesta registrada</span>');
  var despues='<span class="muted">—</span>';
  if(resp){var out=A.filter(function(a){return a.direccion==='saliente'&&a.fecha_hecho&&resp.fecha_hecho&&a.fecha_hecho>resp.fecha_hecho}).sort(function(a,b){return a.fecha_hecho.localeCompare(b.fecha_hecho)})[0];
    despues=out?esc(TIPOS[out.tipo])+' · '+esc(fdt(out.fecha_hecho))+(out.asunto?'<div class="faint">'+esc(out.asunto)+'</div>':''):'<span class="muted">Nada registrado después de la respuesta</span>'}
  var mat=F.materiales.slice().sort(function(a,b){return String(b.enviado_en||'').localeCompare(String(a.enviado_en||''))})[0],dev='<span class="muted">No se registraron materiales</span>';
  if(mat){var post=matResp(mat);dev=esc(MATS[mat.tipo])+': '+esc(mat.titulo)+' — '+(post?'devolución '+(post.fecha_hecho?esc(fdt(post.fecha_hecho)):'sin fecha'):'<span class="sv">sin devolución registrada</span>')}
  var actor=!c?'<span class="muted">Sin conversación</span>':c.atencion==='nos_toca_responder'?'<b>Nosotros</b>':c.atencion==='esperando_prospecto'?'El prospecto':c.atencion==='esperando_derivacion'?'Otra persona de la empresa (derivación)':c.atencion==='seguimiento_programado'?'Nosotros, en la fecha programada':c.atencion==='pausado'?'Nadie por ahora (pausado)':c.atencion==='cerrado'?'Nadie (cerrado)':'<span class="sv">Sin definir</span>';
  var t=F.tareas.filter(function(x){return x.estado==='pendiente'})[0];
  var next=c&&c.proximo_paso?esc(c.proximo_paso)+' '+dchip(c.proximo_paso_fecha):t?esc(t.accion)+' '+dchip(t.fecha)+' · '+(t.responsable?esc(t.responsable):'<span class="sv">sin responsable</span>'):(c&&c.atencion==='nos_toca_responder'?'<span class="sv">Responder la última respuesta · sin tarea creada</span>':'<span class="muted">Sin próximo paso</span>');
  return '<div class="resumen">'+
    rk('Con quién hablamos',quien)+rk('Qué respondió y cuándo',respTxt)+rk('Qué le enviamos después',despues)+rk('Devolución tras el material',dev)+
    rk('Situación',(c?etapa(c.etapa)+' '+atenc(c.atencion):etapa('sin_contactar'))+(c&&c.etapa_evidencia?'<div class="faint">'+esc(c.etapa_evidencia)+'</div>':''))+
    rk('Quién actúa y próximo paso',actor+'<div>'+next+'</div>')+(e.resumen?'<div class="full">'+rk('Resumen',esc(e.resumen))+'</div>':'')+'</div>';
}
function rk(k,v){return '<div><div class="k">'+esc(k)+'</div><div class="v">'+v+'</div></div>'}
function byFecha(a,b){return String(b.fecha_hecho||'').localeCompare(String(a.fecha_hecho||''))}
function matResp(m){if(m.respuesta_actividad_id)return F.actividades.find(function(a){return a.id===m.respuesta_actividad_id});
  if(!m.enviado_en)return null;return F.actividades.filter(function(a){return a.direccion==='entrante'&&a.tipo!=='rebote'&&a.fecha_hecho&&a.fecha_hecho>m.enviado_en}).sort(function(a,b){return a.fecha_hecho.localeCompare(b.fecha_hecho)})[0]||null}
function renderFicha(){
  var e=F.empresa,v=F.vista||{};
  var tabs=[['crono','Cronología ('+F.actividades.length+')'],['contactos','Contactos ('+F.contactos.length+')'],['materiales','Propuestas y materiales ('+F.materiales.length+')'],['tareas','Tareas y seguimientos ('+F.tareas.filter(function(t){return t.estado==='pendiente'}).length+')'],['datos','Datos y fuentes ('+F.fuentes.length+')'],['historial','Historial original']];
  $('#ficha').innerHTML='<div class="f-head"><div class="f-top"><div><p class="px-eb">'+esc(e.origen||'Origen sin dato')+'</p><h2>'+esc(e.nombre)+'</h2><div class="f-sub">'+(e.nicho?'<span style="color:var(--sl)">'+esc(e.nicho)+'</span>'+(e.nicho_fuente==='rubro'||e.nicho_fuente==='base'?' <span class="faint">(asignado por '+esc(e.nicho_fuente)+')</span>':'')+' · ':'')+esc(uniq([e.grupo,e.rubro,e.ciudad,e.pais],[e.nicho]).join(' · ')||'Rubro y ubicación pendientes de completar')+'</div>'+
    '<div class="f-flags">'+(e.no_contactar?'<span class="chip flag" title="'+esc(e.no_contactar_motivo||'')+'">No contactar</span>':'')+(v.error_canal?'<span class="chip warnf">Error de canal</span>':'')+(F.revision.filter(function(r){return r.estado==='abierta'}).length?'<span class="chip warnf">'+F.revision.filter(function(r){return r.estado==='abierta'}).length+' a revisar</span>':'')+(v.bases||[]).filter(Boolean).map(function(b){return '<span class="chip plain">'+esc(b)+'</span>'}).join('')+'</div></div>'+
    '<div style="display:flex;gap:8px"><button class="px-btn g sm" data-fact="situacion">Editar situación</button><button class="x" data-fclose aria-label="Cerrar">×</button></div></div>'+resumen()+
    '<nav class="ftabs">'+tabs.map(function(t){return '<button data-ftab="'+t[0]+'" class="'+(ftab===t[0]?'on':'')+'">'+esc(t[1])+'</button>'}).join('')+'</nav></div><div class="f-body" id="fbody"></div>';
  renderFTab();
}
function renderFTab(){
  var b=$('#fbody'),e=F.empresa,v=F.vista||{};
  if(ftab==='crono'){
    var A=actsSorted();var canales={},tipos={};A.forEach(function(a){if(a.canal)canales[a.canal]=1;tipos[a.tipo]=1});
    var L=A.filter(function(a){return (!fcanal||a.canal===fcanal)&&(!ftipo||a.tipo===ftipo)});
    b.innerHTML='<div class="filters"><select class="in" id="fcan">'+opts(Object.keys(canales).map(function(c){return [c,c]}),fcanal,'Todo canal')+'</select><select class="in" id="ftip">'+opts(Object.keys(tipos).map(function(t){return [t,TIPOS[t]||t]}),ftipo,'Todo tipo')+'</select><span style="flex:1"></span><button class="px-btn p sm" data-fact="actividad">Registrar actividad</button></div>'+
      (v.sin_desglosar?'<div class="note" style="margin-bottom:12px">Actividad sin desglosar; consultar historial. Esta empresa figura como contactada en el origen, pero sin mensajes con fecha. <button class="more" data-ftab="historial">Ver historial original</button></div>':'')+
      (L.length?'<div class="tl">'+L.map(evHtml).join('')+'</div>':'<div class="empty">'+(A.length?'Ninguna actividad con estos filtros.':'Sin actividades registradas.')+'</div>');
    $('#fcan').onchange=function(){fcanal=this.value;renderFTab()};$('#ftip').onchange=function(){ftipo=this.value;renderFTab()};
  }
  if(ftab==='contactos'){
    b.innerHTML='<div class="acts" style="margin:0 0 12px"><button class="px-btn p sm" data-fact="contacto">Agregar contacto</button></div>'+(F.contactos.length?'<div class="grid2">'+F.contactos.map(function(k){
      return '<div class="card"><div style="display:flex;gap:10px;align-items:center">'+av(k.nombre||k.email)+'<div><b>'+pend(k.nombre)+'</b><div class="faint">'+(k.cargo?esc(k.cargo):'Cargo sin verificar')+'</div></div></div>'+
        '<dl class="kv" style="margin-top:12px"><dt>Rol en la decisión</dt><dd>'+(k.rol_decision?esc(ROLES[k.rol_decision]):sv())+(k.datos_extra&&k.datos_extra.rol_crm_v1&&!k.rol_decision?' <span class="faint">(el CRM viejo lo marcaba “'+esc(ROLES[k.datos_extra.rol_crm_v1]||k.datos_extra.rol_crm_v1)+'”, sin evidencia)</span>':'')+'</dd><dt>Email</dt><dd>'+pend(k.email)+'</dd><dt>Teléfono</dt><dd>'+pend(k.telefono)+'</dd><dt>WhatsApp</dt><dd>'+pend(k.whatsapp)+'</dd><dt>Canal preferido</dt><dd>'+pend(k.canal_preferido)+'</dd><dt>Verificación</dt><dd>'+(k.nivel_verificacion?'Nivel '+esc(k.nivel_verificacion)+' · ':'')+(k.fuentes_verificacion?esc(k.fuentes_verificacion):sv('Sin fuente'))+'</dd></dl>'+
        (k.error_canal?'<div class="note" style="margin-top:10px">Error de canal: '+esc(k.error_canal_motivo||'')+(k.error_canal_fecha?' · '+esc(fdt(k.error_canal_fecha)):'')+(k.error_canal_evidencia?' · '+link(k.error_canal_evidencia,'evidencia'):'')+'</div>':'')+
        (k.no_contactar?'<div class="note" style="margin-top:10px">No contactar: '+esc(k.no_contactar_motivo||'')+'</div>':'')+
        '<div class="acts"><button class="px-btn g xs" data-fact="contacto" data-id="'+k.id+'">Editar</button></div></div>'}).join('')+'</div>':'<div class="empty">Sin contactos identificados.</div>');
  }
  if(ftab==='materiales'){
    b.innerHTML='<div class="acts" style="margin:0 0 12px"><button class="px-btn p sm" data-fact="material">Registrar material o propuesta</button></div><p class="faint">Un ejemplo de referencia no es una propuesta comercial, y una propuesta no es un presupuesto.</p>'+
      table(['Tipo','Material','Versión','Destinatario','Enviado','Respuesta posterior registrada'],F.materiales.map(function(m){var r=matResp(m);
        return '<tr><td><span class="chip" style="--c:'+(m.tipo==='ejemplo_referencia'?'#38D6FF':m.tipo==='propuesta_comercial'?'#FFB84D':'#4BE39A')+'">'+esc(MATS[m.tipo])+'</span></td><td><b>'+esc(m.titulo)+'</b><div class="faint">'+link(m.url,'Abrir enlace')+'</div></td><td>'+pend(m.version)+'</td><td>'+(m.contacto_id?esc(cname(m.contacto_id)):sv('Sin destinatario'))+'</td><td>'+(m.enviado_en?esc(fdt(m.enviado_en)):sv())+'</td><td>'+(m.respuesta_resumen?esc(m.respuesta_resumen):r?esc(fdt(r.fecha_hecho))+(r.texto?'<div class="faint">'+esc(strip(r.texto).slice(0,120))+'</div>':''):'<span class="sv">Sin respuesta registrada</span>')+'</td></tr>'}),'No se registraron materiales.');
  }
  if(ftab==='tareas'){
    b.innerHTML='<div class="acts" style="margin:0 0 12px"><button class="px-btn p sm" data-fact="tarea">Nueva tarea</button></div><p class="faint">Las tareas son recordatorios para una persona: programar una revisión no envía mensajes.</p>'+
      table(['Estado','Acción','Fecha','Responsable','Origen',''],F.tareas.map(function(t){return '<tr><td>'+esc({pendiente:'Pendiente',hecha:'Hecha',cancelada:'Cancelada'}[t.estado])+'</td><td class="w"><b>'+esc(t.accion)+'</b></td><td>'+(t.estado==='pendiente'?dchip(t.fecha):esc(fd(t.fecha)))+'</td><td>'+(t.responsable?esc(t.responsable):'<span class="sv">Sin asignar</span>')+'</td><td class="faint">'+esc(t.origen||'')+'</td><td>'+(t.estado==='pendiente'?'<button class="px-btn g xs" data-tdone="'+esc(t.clave)+'" data-st="hecha">Hecha</button> <button class="px-btn g xs" data-tdone="'+esc(t.clave)+'" data-st="cancelada">Cancelar</button>':'')+'</td></tr>'}),'Sin tareas.');
  }
  if(ftab==='datos'){
    var x=e.datos_extra||{},v1=x.crm_v1||{};
    var extra=Object.keys(x).filter(function(k){return k!=='crm_v1'&&k!=='contacto_previo'}).map(function(k){return '<dt>'+esc(k)+' <span class="faint">(reportado)</span></dt><dd>'+esc(typeof x[k]==='object'?JSON.stringify(x[k]):x[k])+'</dd>'}).join('');
    b.innerHTML='<div class="acts" style="margin:0 0 12px"><button class="px-btn p sm" data-fact="empresa">Editar datos</button><button class="px-btn g sm" data-fact="marca">Marcar No contactar / Error de canal</button></div>'+
      '<div class="grid2"><div class="card"><h3>Empresa</h3><dl class="kv"><dt>Nombre</dt><dd>'+esc(e.nombre)+'</dd><dt>Grupo empresarial</dt><dd>'+pend(e.grupo)+'</dd><dt>Nicho</dt><dd>'+pend(e.nicho)+(e.nicho_fuente?' <span class="faint">· fuente: '+esc({registro:'campo Nicho del registro',rubro:'regla sobre el rubro',base:'base de origen',manual:'elegido a mano'}[e.nicho_fuente])+'</span>':'')+'</dd><dt>Rubro</dt><dd>'+pend(e.rubro)+'</dd><dt>País</dt><dd>'+pend(e.pais)+'</dd><dt>Ciudad</dt><dd>'+pend(e.ciudad)+'</dd><dt>Zona horaria</dt><dd>'+pend(e.zona_horaria)+'</dd><dt>Dirección</dt><dd>'+pend(e.direccion)+'</dd><dt>Web</dt><dd>'+(e.web?link(e.web,e.web):pend())+'</dd><dt>Teléfono</dt><dd>'+pend(e.telefono)+'</dd><dt>WhatsApp</dt><dd>'+(e.whatsapp?(safeUrl(e.whatsapp)?link(e.whatsapp,'Abrir chat'):esc(e.whatsapp)):pend())+'</dd><dt>Redes</dt><dd>'+(Object.keys(e.redes||{}).length?Object.keys(e.redes).map(function(k){return esc(k)+': '+link(e.redes[k],e.redes[k])}).join('<br>'):pend())+'</dd><dt>Origen</dt><dd>'+pend(e.origen)+'</dd><dt>Responsable interno</dt><dd>'+(e.responsable?esc(e.responsable):'<span class="sv">Sin asignar</span>')+'</dd></dl></div>'+
      '<div class="card"><h3>Fechas y marcas</h3><dl class="kv"><dt>Alta en el origen</dt><dd>'+(e.creado_origen?esc(fdt(e.creado_origen)):sv())+'</dd><dt>Importada al CRM</dt><dd>'+(e.importado_en?esc(fdt(e.importado_en)):sv())+' <span class="faint">(no es un contacto)</span></dd><dt>Etapa en el CRM viejo</dt><dd>'+esc(v1.stage==null?'—':v1.stage)+'</dd>'+
      '<dt>No contactar</dt><dd>'+(e.no_contactar?'Sí · '+esc(e.no_contactar_motivo||'')+(e.no_contactar_fecha?' · '+esc(fdt(e.no_contactar_fecha)):' · fecha sin verificar')+(e.no_contactar_evidencia?' · '+link(e.no_contactar_evidencia,'evidencia'):''):'No')+'</dd>'+
      '<dt>Error de canal</dt><dd>'+(e.error_canal?'Sí · '+esc(e.error_canal_motivo||'')+(e.error_canal_fecha?' · '+esc(fdt(e.error_canal_fecha)):' · fecha sin verificar')+(e.error_canal_evidencia?' · '+link(e.error_canal_evidencia,'evidencia'):''):'No')+'</dd>'+extra+'</dl></div></div>'+
      (F.tandas.length?'<div class="card" style="margin-top:16px"><h3>Participación en tandas</h3>'+table(['Tanda','Variante','Intento','Resultado'],F.tandas.map(function(t){return '<tr><td>'+esc(t.tanda)+'</td><td>'+esc(t.variante||'—')+'</td><td>'+t.intento+(t.reposicion?' <span class="chip warnf">Reposición</span>':'')+'</td><td>'+esc(ENVIO[t.resultado]||t.resultado||'Sin dato')+'</td></tr>'}),'')+'</div>':'')+
      '<h3 style="margin:20px 0 10px;font-size:15px">Fuentes ('+F.fuentes.length+')</h3>'+F.fuentes.map(function(s,i){return '<details class="src" data-src="'+i+'"><summary><b>'+esc(s.base||s.sistema)+'</b>'+(s.tabla?' / '+esc(s.tabla):'')+' · <span class="mono">'+esc(s.registro||s.clave)+'</span> · alta '+(s.creado_origen?esc(fd(s.creado_origen)):'sin dato')+'</summary><div class="srcb"></div></details>'}).join('')+
      (F.cambios.length?'<h3 style="margin:20px 0 10px;font-size:15px">Historial de cambios</h3>'+table(['Cuándo','Quién','Campo','Antes','Después'],F.cambios.map(function(c){return '<tr><td class="dt">'+esc(fdt(c.hecho_en))+'</td><td>'+esc(c.hecho_por)+'</td><td>'+esc(c.campo)+'</td><td class="w faint">'+esc(JSON.stringify(c.antes)).slice(0,120)+'</td><td class="w">'+esc(JSON.stringify(c.despues)).slice(0,120)+'</td></tr>'}),''):'')+
      (F.revision.length?'<h3 style="margin:20px 0 10px;font-size:15px">Revisión</h3>'+F.revision.map(function(r){return '<div class="note" style="margin-bottom:6px">'+esc(REVT[r.tipo]||r.tipo)+' · '+esc(r.detalle)+' · <b>'+esc(r.estado)+'</b>'+(r.resolucion?' — '+esc(r.resolucion):'')+'</div>'}).join(''):'');
    $$('details.src').forEach(function(d){d.addEventListener('toggle',function(){if(!d.open)return;var s=F.fuentes[+d.dataset.src],box=d.querySelector('.srcb');if(box.innerHTML)return;
      box.innerHTML='<dl class="kv" style="margin-top:10px"><dt>Sistema</dt><dd>'+esc(s.sistema)+'</dd><dt>Enlace</dt><dd>'+(s.url?link(s.url,'Abrir en el origen'):'—')+'</dd><dt>Importado</dt><dd>'+(s.importado_en?esc(fdt(s.importado_en)):'—')+'</dd></dl>'+(s.texto_original?'<pre class="orig" style="margin-top:10px">'+esc(s.texto_original)+'</pre>':'<pre class="orig">'+esc(JSON.stringify(s.campos,null,2))+'</pre>')})});
  }
  if(ftab==='historial'){
    b.innerHTML='<p class="faint">Notas importadas completas, tal como estaban en el CRM viejo. Nada de esto se borró ni se resumió.</p>'+(e.notas_originales?'<pre class="orig">'+esc(e.notas_originales)+'</pre>':'<div class="empty">Sin notas originales.</div>');
  }
}
function nkey(x){return String(x).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/s$/,'')}
function uniq(a,seed){var s={};(seed||[]).forEach(function(x){if(x)s[nkey(x)]=1});return a.filter(function(x){if(!x)return false;var k=nkey(x);if(s[k])return false;s[k]=1;return true})}
function emp(n){return n+(Number(n)===1?' empresa':' empresas')}
function dias(n){return n+(Number(n)===1?' día':' días')}
function evHtml(a){
  var dir=a.direccion==='entrante'?'ev-in':a.direccion==='saliente'?'ev-out':'';var bad=a.tipo==='rebote'||a.estado_envio==='rebotado';
  var t=strip(a.texto||''),long=t.length>420;
  return '<div class="ev '+dir+(bad?' bad':'')+'"><div class="ev-h"><b>'+esc(TIPOS[a.tipo]||a.tipo)+'</b><span>'+(a.direccion==='entrante'?'del prospecto':a.direccion==='saliente'?'nuestro':'interno')+'</span>'+(a.canal?'<span class="chip plain">'+esc(a.canal)+'</span>':'')+
    '<span class="dt">'+(a.fecha_hecho?esc(fdt(a.fecha_hecho))+(a.fecha_precision==='dia'?' (solo día)':''):'<span class="sv">Fecha sin verificar</span>')+'</span>'+
    (a.contacto_id?'<span>'+esc(cname(a.contacto_id))+'</span>':'')+(a.estado_envio?'<span class="chip'+(bad?' warnf':'')+'">'+'Envío: '+esc(ENVIO[a.estado_envio])+'</span>':'')+(a.clasificacion?'<span class="chip" style="--c:#4BE39A">'+esc(CLASIF[a.clasificacion])+'</span>':'')+(a.primera_respuesta?'<span class="chip plain">Primera respuesta</span>':'')+(a.es_reposicion?'<span class="chip warnf">Reposición</span>':'')+(a.variante?'<span class="chip plain">'+esc(a.variante)+'</span>':'')+'</div>'+
    (a.asunto?'<div style="margin-top:6px;font-weight:500">'+esc(a.asunto)+'</div>':'')+
    (t?'<div class="ev-t'+(long?' clip':'')+'">'+(a.es_resumen?'<span class="faint">Resumen registrado: </span>':'')+esc(t)+'</div>'+(long?'<button class="more" data-unclip>Ver texto completo</button>':''):'<div class="ev-t"><span class="sv">Texto no registrado</span></div>')+
    '<div class="ev-f">'+(a.fecha_reporte?'<span>Reportado '+esc(fdt(a.fecha_reporte))+'</span>':'')+(a.importado_en?'<span>Importado '+esc(fdt(a.importado_en))+'</span>':'')+(a.reemplaza?'<span>Reemplaza: '+esc(a.reemplaza)+'</span>':'')+(a.message_id?'<span class="mono">ID '+esc(a.message_id)+'</span>':'')+(a.evidencia?'<span>'+(safeUrl(a.evidencia)?link(a.evidencia,'Evidencia'):'Evidencia: '+esc(a.evidencia))+'</span>':'<span class="sv">Sin evidencia enlazada</span>')+(a.responsable?'<span>Por '+esc(a.responsable)+'</span>':'')+'</div></div>';
}

/* ---------- formularios de la ficha (todo se guarda con crm_importar) ---------- */
function convClave(){var c=conv();return c?c.clave:'conv:'+F.empresa.clave}
function contactOpts(sel){return '<option value="">Sin contacto</option>'+F.contactos.map(function(k){return '<option value="'+esc(k.clave)+'"'+(sel===k.id?' selected':'')+'>'+esc(k.nombre||k.email)+'</option>'}).join('')}
function val(id){var e=$('#'+id);return e?e.value.trim():''}
function fact(kind,id){
  var e=F.empresa,c=conv();
  if(kind==='situacion'){
    modal('<h3 style="font-size:18px">Situación comercial</h3><p class="faint">Etapa y atención son independientes. Dejá la evidencia de por qué cambia la etapa.</p><div class="form">'+
      '<label class="f"><span>Etapa comercial</span><select class="in" id="s_et">'+opts(ETAPAS,c?c.etapa:'contacto_iniciado')+'</select></label>'+
      '<label class="f"><span>Estado de atención</span><select class="in" id="s_at">'+opts(ATENCION,c&&c.atencion,'Sin definir')+'</select></label>'+
      '<label class="f full"><span>Evidencia del cambio de etapa</span><input class="in" id="s_ev" placeholder="Ej.: aceptó la reunión del jueves por WhatsApp" value="'+esc(c&&c.etapa_evidencia||'')+'"></label>'+
      '<label class="f"><span>Canal</span><select class="in" id="s_ca">'+opts(CANALES.map(function(x){return [x,x]}),c&&c.canal,'Sin dato')+'</select></label>'+
      '<label class="f"><span>Responsable</span><input class="in" id="s_re" value="'+esc(c&&c.responsable||'')+'"></label>'+
      '<label class="f"><span>Objetivo</span><input class="in" id="s_ob" value="'+esc(c&&c.objetivo||'')+'"></label>'+
      '<label class="f"><span>Solución de interés</span><input class="in" id="s_so" value="'+esc(c&&c.solucion_interes||'')+'"></label>'+
      '<label class="f"><span>Valor estimado (USD)</span><input class="in" id="s_va" type="number" min="0" value="'+esc(c&&c.valor||'')+'"></label>'+
      '<label class="f"><span>Motivo de pérdida</span><input class="in" id="s_mp" value="'+esc(c&&c.motivo_perdida||'')+'"></label></div>'+
      '<div class="note" style="margin-top:12px">Aceptar ejemplos, dar un correo o decir “lo tendré en cuenta” no equivale a aceptar una propuesta ni a concretar una reunión. Un rebote no hace perder la oportunidad.</div>'+
      '<div class="acts"><button class="px-btn p sm" id="s_ok">Guardar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
    $('#s_ok').onclick=function(){save({conversaciones:[{clave:convClave(),empresa:e.clave,etapa:val('s_et'),atencion:val('s_at')||null,etapa_evidencia:val('s_ev'),canal:val('s_ca'),responsable:val('s_re'),objetivo:val('s_ob'),solucion_interes:val('s_so'),valor:val('s_va')?+val('s_va'):null,motivo_perdida:val('s_mp')}]})};
  }
  if(kind==='actividad'){
    modal('<h3 style="font-size:18px">Registrar actividad</h3><p class="faint">Una entrada por mensaje, respuesta, llamada, reunión, envío, derivación, rebote o baja. Si no sabés la fecha exacta, dejala vacía: queda “sin verificar”.</p><div class="form">'+
      '<label class="f"><span>Tipo</span><select class="in" id="a_ti">'+opts(sel(TIPOS),'mensaje')+'</select></label>'+
      '<label class="f"><span>Dirección</span><select class="in" id="a_di">'+opts([['saliente','Nuestra (saliente)'],['entrante','Del prospecto (entrante)'],['interna','Interna']],'saliente')+'</select></label>'+
      '<label class="f"><span>Canal</span><select class="in" id="a_ca">'+opts(CANALES.map(function(x){return [x,x]}),c&&c.canal||'WhatsApp')+'</select></label>'+
      '<label class="f"><span>Fecha y hora real</span><input class="in" id="a_fe" type="datetime-local"></label>'+
      '<label class="f"><span>Contacto</span><select class="in" id="a_co">'+contactOpts()+'</select></label>'+
      '<label class="f"><span>Estado del envío (email)</span><select class="in" id="a_es">'+opts(sel(ENVIO),'','Sin dato')+'</select></label>'+
      '<label class="f"><span>Clasificación (respuestas humanas)</span><select class="in" id="a_cl">'+opts(sel(CLASIF),'','Sin clasificar')+'</select></label>'+
      '<label class="f"><span>¿Primera respuesta?</span><select class="in" id="a_pr">'+opts([['no','No'],['si','Sí']],'no')+'</select></label>'+
      '<label class="f full"><span>Asunto o título</span><input class="in" id="a_as"></label>'+
      '<label class="f full"><span>Texto o resumen fiel</span><textarea class="in" id="a_tx" placeholder="Pegá el texto tal cual, o un resumen fiel"></textarea></label>'+
      '<label class="f"><span>¿Es un resumen?</span><select class="in" id="a_re">'+opts([['no','No, es el texto'],['si','Sí, es un resumen']],'no')+'</select></label>'+
      '<label class="f"><span>Evidencia (enlace)</span><input class="in" id="a_ev" placeholder="https://"></label>'+
      '<label class="f"><span>Message ID (para no duplicar)</span><input class="in" id="a_mi"></label></div>'+
      '<div class="acts"><button class="px-btn p sm" id="a_ok">Guardar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
    $('#a_ok').onclick=function(){var fe=val('a_fe'),mi=val('a_mi');
      var a={clave:mi?'msg:'+mi:'ui:'+uuid(),empresa:e.clave,conversacion:convClave(),contacto:val('a_co')||null,tipo:val('a_ti'),direccion:val('a_di'),canal:val('a_ca'),
        fecha_hecho:fe?new Date(fe).toISOString():null,fecha_precision:fe?'exacta':'sin_verificar',fecha_reporte:new Date().toISOString(),asunto:val('a_as'),texto:val('a_tx'),es_resumen:val('a_re')==='si',
        estado_envio:val('a_es')||null,clasificacion:val('a_cl')||null,primera_respuesta:val('a_pr')==='si',evidencia:val('a_ev'),message_id:mi||null,responsable:me};
      var p={actividades:[a]};if(!c)p.conversaciones=[{clave:convClave(),empresa:e.clave,etapa:'contacto_iniciado',atencion:a.direccion==='entrante'?'nos_toca_responder':'esperando_prospecto',etapa_evidencia:'Primera actividad registrada a mano',canal:a.canal}];
      save(p,'completar')};
  }
  if(kind==='contacto'){
    var k=id?F.contactos.find(function(x){return x.id===id}):{};
    modal('<h3 style="font-size:18px">'+(id?'Editar':'Agregar')+' contacto</h3><div class="form">'+
      '<label class="f"><span>Nombre completo</span><input class="in" id="k_no" value="'+esc(k.nombre||'')+'"></label><label class="f"><span>Cargo exacto</span><input class="in" id="k_ca" value="'+esc(k.cargo||'')+'"></label>'+
      '<label class="f"><span>Rol en la decisión</span><select class="in" id="k_ro">'+opts(sel(ROLES),k.rol_decision,'Sin verificar')+'</select></label><label class="f"><span>Canal preferido</span><select class="in" id="k_cp">'+opts(CANALES.map(function(x){return [x,x]}),k.canal_preferido,'Sin dato')+'</select></label>'+
      '<label class="f"><span>Email</span><input class="in" id="k_em" type="email" value="'+esc(k.email||'')+'"></label><label class="f"><span>Teléfono</span><input class="in" id="k_te" value="'+esc(k.telefono||'')+'"></label>'+
      '<label class="f"><span>WhatsApp</span><input class="in" id="k_wa" value="'+esc(k.whatsapp||'')+'"></label><label class="f"><span>Fuentes de verificación</span><input class="in" id="k_fu" value="'+esc(k.fuentes_verificacion||'')+'"></label></div>'+
      '<div class="acts"><button class="px-btn p sm" id="k_ok">Guardar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
    $('#k_ok').onclick=function(){if(!val('k_no')&&!val('k_em')){toast('Poné al menos nombre o email','warn');return}
      save({contactos:[{clave:k.clave||'ui:'+uuid(),empresa:e.clave,nombre:val('k_no'),cargo:val('k_ca'),rol_decision:val('k_ro')||null,canal_preferido:val('k_cp'),email:val('k_em').toLowerCase(),telefono:val('k_te'),whatsapp:val('k_wa'),fuentes_verificacion:val('k_fu')}]})};
  }
  if(kind==='material'){
    modal('<h3 style="font-size:18px">Registrar material o propuesta</h3><div class="form">'+
      '<label class="f"><span>Tipo</span><select class="in" id="m_ti">'+opts(sel(MATS),'propuesta_comercial')+'</select></label><label class="f"><span>Versión</span><input class="in" id="m_ve" placeholder="v1"></label>'+
      '<label class="f full"><span>Título</span><input class="in" id="m_tt"></label><label class="f full"><span>Enlace</span><input class="in" id="m_ur" placeholder="https://"></label>'+
      '<label class="f"><span>Destinatario</span><select class="in" id="m_de">'+contactOpts()+'</select></label><label class="f"><span>Fecha de envío</span><input class="in" id="m_fe" type="datetime-local"></label>'+
      '<label class="f full"><span>Respuesta posterior registrada</span><input class="in" id="m_rr" placeholder="Dejalo vacío si no hubo devolución"></label></div>'+
      '<div class="acts"><button class="px-btn p sm" id="m_ok">Guardar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
    $('#m_ok').onclick=function(){if(!val('m_tt')){toast('Poné un título','warn');return}var fe=val('m_fe');
      save({materiales:[{clave:'ui:'+uuid(),empresa:e.clave,conversacion:convClave(),contacto:val('m_de')||null,tipo:val('m_ti'),titulo:val('m_tt'),version:val('m_ve'),url:val('m_ur'),enviado_en:fe?new Date(fe).toISOString():null,respuesta_resumen:val('m_rr')}]},'completar')};
  }
  if(kind==='tarea'){
    modal('<h3 style="font-size:18px">Nueva tarea</h3><p class="faint">Es un recordatorio: no envía nada solo.</p><div class="form"><label class="f full"><span>Acción concreta</span><input class="in" id="t_ac" placeholder="Ej.: llamar a Ana para confirmar si recibió la propuesta"></label>'+
      '<label class="f"><span>Fecha</span><input class="in" id="t_fe" type="date" value="'+addDays(today(),2)+'"></label><label class="f"><span>Responsable</span><input class="in" id="t_re" value="'+esc(c&&c.responsable||'')+'"></label></div>'+
      '<div class="acts"><button class="px-btn p sm" id="t_ok">Guardar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
    $('#t_ok').onclick=function(){if(!val('t_ac')){toast('Escribí la acción','warn');return}
      var p={tareas:[{clave:'ui:'+uuid(),empresa:e.clave,conversacion:c?c.clave:null,accion:val('t_ac'),fecha:val('t_fe')||null,responsable:val('t_re'),estado:'pendiente',origen:'Manual'}]};
      if(c&&c.atencion==='esperando_prospecto')p.conversaciones=[{clave:c.clave,empresa:e.clave,atencion:'seguimiento_programado'}];
      save(p,'actualizar')};
  }
  if(kind==='empresa'){
    modal('<h3 style="font-size:18px">Datos de la empresa</h3><div class="form">'+[['nombre','Nombre'],['grupo','Grupo empresarial'],['rubro','Rubro'],['pais','País'],['ciudad','Ciudad'],['zona_horaria','Zona horaria (ej. America/Montevideo)'],['direccion','Dirección'],['web','Web'],['telefono','Teléfono'],['whatsapp','WhatsApp'],['responsable','Responsable interno'],['origen','Origen']].map(function(x){return '<label class="f"><span>'+esc(x[1])+'</span><input class="in" id="e_'+x[0]+'" value="'+esc(e[x[0]]||'')+'"></label>'}).join('')+
      '<label class="f"><span>Nicho</span><input class="in" id="e_nicho" list="nichosList" value="'+esc(e.nicho||'')+'"><datalist id="nichosList">'+((ORIGENES&&ORIGENES.n)||[]).map(function(n){return '<option value="'+esc(n)+'">'}).join('')+'</datalist></label>'+
      '<label class="f"><span>Instagram</span><input class="in" id="e_ig" value="'+esc((e.redes||{}).instagram||'')+'"></label><label class="f full"><span>Resumen breve</span><textarea class="in" id="e_resumen">'+esc(e.resumen||'')+'</textarea></label></div>'+
      '<p class="faint">Si dejás un campo vacío no se borra el dato anterior.</p><div class="acts"><button class="px-btn p sm" id="e_ok">Guardar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
    $('#e_ok').onclick=function(){var p={clave:e.clave};if(val('e_nicho')&&val('e_nicho')!==e.nicho){p.nicho=val('e_nicho');p.nicho_fuente='manual'}['nombre','grupo','rubro','pais','ciudad','zona_horaria','direccion','web','telefono','whatsapp','responsable','origen','resumen'].forEach(function(k){p[k]=val('e_'+k)});if(val('e_ig'))p.redes={instagram:val('e_ig')};save({empresas:[p]})};
  }
  if(kind==='marca'){
    modal('<h3 style="font-size:18px">Marcas de la empresa</h3><p class="faint">Son independientes de la etapa. Un rebote no marca la oportunidad como perdida.</p><div class="form">'+
      '<label class="f"><span>No contactar</span><select class="in" id="n_nc">'+opts([['no','No'],['si','Sí']],e.no_contactar?'si':'no')+'</select></label><label class="f"><span>Error de canal</span><select class="in" id="n_ec">'+opts([['no','No'],['si','Sí']],e.error_canal?'si':'no')+'</select></label>'+
      '<label class="f full"><span>Motivo</span><input class="in" id="n_mo" placeholder="Ej.: pidió no recibir más mensajes"></label><label class="f"><span>Fecha</span><input class="in" id="n_fe" type="datetime-local"></label><label class="f"><span>Evidencia (enlace o referencia)</span><input class="in" id="n_ev"></label></div>'+
      '<div class="acts"><button class="px-btn p sm" id="n_ok">Guardar</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
    $('#n_ok').onclick=function(){var fe=val('n_fe'),p={clave:e.clave,no_contactar:val('n_nc')==='si',error_canal:val('n_ec')==='si'};
      if(p.no_contactar&&!e.no_contactar){p.no_contactar_motivo=val('n_mo');p.no_contactar_fecha=fe?new Date(fe).toISOString():null;p.no_contactar_evidencia=val('n_ev')}
      if(p.error_canal&&!e.error_canal){p.error_canal_motivo=val('n_mo');p.error_canal_fecha=fe?new Date(fe).toISOString():null;p.error_canal_evidencia=val('n_ev')}
      if((p.no_contactar&&!e.no_contactar||p.error_canal&&!e.error_canal)&&!val('n_mo')){toast('Escribí el motivo','warn');return}
      save({empresas:[p]},'actualizar')};
  }
}
async function save(p,modo){var rep=await guardar(p,modo);if(!rep)return;closeModal();toast('Guardado');var id=F.empresa.id,tab=ftab;await openFicha(id,tab);rerender()}

/* ---------- nueva empresa ---------- */
function nuevaEmpresa(){
  modal('<h3 style="font-size:18px">Nueva empresa</h3><p class="faint">Si se parece a una existente, queda marcada en Revisión. Nunca se fusiona sola.</p><div class="form">'+
    [['nombre','Nombre *'],['rubro','Rubro'],['pais','País'],['ciudad','Ciudad'],['web','Web'],['telefono','Teléfono'],['origen','Origen'],['responsable','Responsable interno']].map(function(x){return '<label class="f"><span>'+esc(x[1])+'</span><input class="in" id="n_'+x[0]+'"></label>'}).join('')+'</div>'+
    '<div class="acts"><button class="px-btn p sm" id="n_ok">Crear</button><button class="px-btn g sm" data-close>Cancelar</button></div>');
  $('#n_ok').onclick=async function(){if(!val('n_nombre')){toast('Falta el nombre','warn');return}
    var cl='ui:'+uuid(),p={clave:cl,importado_en:new Date().toISOString()};['nombre','rubro','pais','ciudad','web','telefono','origen','responsable'].forEach(function(k){p[k]=val('n_'+k)});
    var rep=await guardar({empresas:[p]},'completar');if(!rep)return;closeModal();ORIGENES=null;
    var r=await q(sb.from('crm_empresas').select('id').eq('clave',cl).single());openFicha(r.data.id);rerender()};
}

/* ---------- importar / exportar ---------- */
async function exportar(){
  toast('Preparando la exportación completa…');
  var r=await q(sb.rpc('crm_exportar'));
  descargar(r.data,'crm-genideia-'+today()+'.json');toast('Exportación lista: '+r.data.empresas.length+' empresas con todas sus relaciones.');
}
function descargar(obj,name){var b=new Blob([JSON.stringify(obj,null,1)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}
var IMP=null;
async function importar(file){
  if(file.size>MAX_IMPORT){toast('El archivo pesa '+Math.round(file.size/1048576)+' MB. Desde acá se importan hasta 2 MB por vez para no saturar la base; partilo o usá la API.','warn');return}
  var txt=await file.text(),p;try{p=JSON.parse(txt)}catch(e){toast('El archivo no es un JSON válido','bad');return}
  if(!p||typeof p!=='object'||Array.isArray(p)){toast('Formato inesperado. Usá el formato genideia-crm/2 (ver “Formato de importación”).','bad');return}
  IMP={p:p,name:file.name};previewImport('completar');
}
async function previewImport(modo){
  modal('<div class="empty">Calculando vista previa… (no se guarda nada)</div>');
  var r=await q(sb.rpc('crm_importar',{p:IMP.p,p_aplicar:false,p_modo:modo,p_archivo:IMP.name}));
  reportModal(r.data,false,modo);
}
function reportModal(rep,aplicado,modo){
  var ents=rep.entidades||{};
  var rows=Object.keys(ents).filter(function(k){var c=ents[k];return c.altas+c.actualizaciones+c.sin_cambios+c.conflictos+c.fallidos+c.omitidos>0}).map(function(k){var c=ents[k];return '<tr><td>'+esc(k)+'</td><td class="mono">'+c.altas+'</td><td class="mono">'+c.actualizaciones+'</td><td class="mono">'+c.sin_cambios+'</td><td class="mono">'+c.conflictos+'</td><td class="mono">'+c.omitidos+'</td><td class="mono">'+c.fallidos+'</td></tr>'});
  modal('<h3 style="font-size:18px">'+(aplicado?'Importación aplicada':'Vista previa de la importación')+'</h3><p class="faint">'+esc(IMP.name)+' · modo '+(modo==='completar'?'completar (no pisa datos)':'actualizar (pisa y guarda el valor anterior)')+'</p>'+
    (rep.repetida_de?'<div class="note">Este mismo archivo ya se importó el '+esc(fdt(rep.repetida_de))+'. Repetirlo no duplica nada.</div>':'')+
    table(['Entidad','Altas','Actualizaciones','Sin cambios','Conflictos','Omitidos','Fallidos'],rows,'El archivo no trae registros reconocibles.')+
    (rep.coincidencias&&rep.coincidencias.length?'<h4 style="margin:14px 0 6px">Posibles duplicados ('+rep.coincidencias.length+') — quedan en Revisión</h4><div class="faint">'+rep.coincidencias.slice(0,20).map(function(c){return esc(c.entidad_clave+' ↔ '+c.relacionada_clave+' · '+c.detalle)}).join('<br>')+'</div>':'')+
    (rep.conflictos&&rep.conflictos.length?'<h4 style="margin:14px 0 6px">Conflictos ('+rep.conflictos.length+') — se conserva el dato actual</h4><div class="faint">'+rep.conflictos.slice(0,20).map(function(c){return esc(c.entidad+' '+c.clave+' · '+c.campo+': '+JSON.stringify(c.actual)+' → '+JSON.stringify(c.importado))}).join('<br>')+'</div>':'')+
    (rep.fallidos&&rep.fallidos.length?'<h4 style="margin:14px 0 6px">Fallidos ('+rep.fallidos.length+')</h4><div class="faint">'+rep.fallidos.slice(0,30).map(function(c){return esc(c.entidad+' '+c.clave+' · '+c.error)}).join('<br>')+'</div>':'')+
    (rep.omitidos&&rep.omitidos.length?'<h4 style="margin:14px 0 6px">Omitidos ('+rep.omitidos.length+')</h4><div class="faint">'+rep.omitidos.slice(0,10).map(function(c){return esc(c.entidad+' · '+c.motivo)}).join('<br>')+'</div>':'')+
    '<div class="acts">'+(aplicado?'<button class="px-btn g sm" id="i_dl">Descargar informe</button><button class="px-btn p sm" data-close>Listo</button>':
      '<select class="in" id="i_mo">'+opts([['completar','Completar: solo llena vacíos'],['actualizar','Actualizar: pisa y guarda historial']],modo)+'</select><button class="px-btn p sm" id="i_ap">Aplicar importación</button><button class="px-btn g sm" data-close>Cancelar</button>')+'</div>');
  if(aplicado){$('#i_dl').onclick=function(){descargar(rep,'informe-importacion-'+today()+'.json')};return}
  $('#i_mo').onchange=function(){previewImport(this.value)};
  $('#i_ap').onclick=async function(){var m=$('#i_mo').value;this.disabled=true;this.textContent='Importando…';
    var r=await q(sb.rpc('crm_importar',{p:IMP.p,p_aplicar:true,p_modo:m,p_archivo:IMP.name}));ORIGENES=null;reportModal(r.data,true,m);refreshRevCnt();rerender()};
}
function formato(){
  modal('<h3 style="font-size:18px">Formato de importación y API</h3><p class="faint">Un JSON con listas por entidad. Cada registro lleva una <b>clave</b> estable (ID de Airtable, message_id de Gmail, etc.) y referencia a otros por su clave. Reimportar el mismo archivo no duplica.</p>'+
    '<pre class="orig">'+esc(JSON.stringify({formato:'genideia-crm/2',empresas:[{clave:'airtable:recXXXX',nombre:'Empresa SA',rubro:'Logística',pais:'Uruguay',ciudad:'Montevideo',origen:'Tanda noviembre'}],contactos:[{clave:'airtable:recXXXX:ana@empresa.com',empresa:'airtable:recXXXX',nombre:'Ana Pérez',cargo:'Gerente de operaciones',email:'ana@empresa.com'}],conversaciones:[{clave:'conv:airtable:recXXXX',empresa:'airtable:recXXXX',etapa:'contacto_iniciado',atencion:'esperando_prospecto',contactos:['airtable:recXXXX:ana@empresa.com']}],actividades:[{clave:'gmail:18c2…',empresa:'airtable:recXXXX',conversacion:'conv:airtable:recXXXX',contacto:'airtable:recXXXX:ana@empresa.com',tipo:'mensaje',direccion:'saliente',canal:'Email',fecha_hecho:'2026-11-19T15:06:43Z',asunto:'…',texto:'…',estado_envio:'sin_error_al_corte',message_id:'18c2…',tanda:'tanda:2026-11-19'}],tareas:[{clave:'…',empresa:'airtable:recXXXX',accion:'Revisar respuestas',fecha:'2026-11-23'}],tandas:[{clave:'tanda:2026-11-19',nombre:'Tanda 19/11',canal:'Email'}]},null,2))+'</pre>'+
    '<p class="faint">También: materiales, participaciones, fuentes, ejecuciones (administrativo) y revision. La exportación completa usa este mismo formato.</p>'+
    '<h4 style="margin:14px 0 6px">API para asistentes</h4><p class="faint">POST a <span class="mono">'+esc(SB_URL)+'/functions/v1/crm-api</span> con el encabezado <span class="mono">x-api-key</span> (la clave se guarda fuera del navegador). Acciones: buscar_empresas, ficha, importar (vista previa o aplicar), registrar_actividad, crear_tarea, tareas, tandas, exportar.</p>'+
    '<div class="acts"><button class="px-btn g sm" data-close>Cerrar</button></div>');
}

/* ---------- modal ---------- */
function modal(html){var m=$('#modal');m.innerHTML='<div class="card">'+html+'</div>';m.hidden=false}
function closeModal(){var m=$('#modal');m.hidden=true;m.innerHTML=''}

/* ---------- eventos globales ---------- */
document.addEventListener('click',async function(ev){
  var t=ev.target,el;
  if((el=t.closest('#tabs button'))){show(el.dataset.view);return}
  if(t.closest('[data-close]')||t===$('#modal')){closeModal();return}
  if(t.closest('[data-fclose]')||t===$('#scrim')){closeFicha();return}
  if((el=t.closest('[data-ftab]'))&&F){ftab=el.dataset.ftab;$$('.ftabs button').forEach(function(b){b.classList.toggle('on',b.dataset.ftab===ftab)});renderFTab();return}
  if((el=t.closest('[data-fact]'))&&F){fact(el.dataset.fact,el.dataset.id);return}
  if((el=t.closest('[data-unclip]'))){var p=el.previousElementSibling;p.classList.remove('clip');el.remove();return}
  if((el=t.closest('[data-tdone]'))&&F){var tk=F.tareas.find(function(x){return x.clave===el.dataset.tdone});save({tareas:[{clave:tk.clave,empresa:F.empresa.clave,accion:tk.accion,estado:el.dataset.st,hecha_en:new Date().toISOString()}]},'actualizar');return}
  if((el=t.closest('[data-emp]'))){openFicha(el.dataset.emp);if(!$('#modal').hidden)closeModal();return}
  if((el=t.closest('[data-go]'))){show(el.dataset.go);return}
  if((el=t.closest('[data-goemp]'))){EF=Object.assign(EF,{etapa:el.dataset.goemp,page:0});show('empresas');return}
  if((el=t.closest('[data-gonicho]'))){EF=Object.assign(EF,{nicho:el.dataset.gonicho,etapa:'',page:0});closeModal();show('empresas');return}
  if((el=t.closest('[data-nicho]'))){verNicho(el.dataset.nicho);return}
  if((el=t.closest('[data-goconv]'))){CF=Object.assign(CF,{etapa:el.dataset.goconv,page:0});show('conversaciones');return}
  if((el=t.closest('[data-pg]'))){var st={conv:CF,emp:EF,rev:RF}[el.dataset.pg];st.page=Math.max(0,st.page+(+el.dataset.d));rerender();window.scrollTo({top:0,behavior:'smooth'});return}
  if((el=t.closest('[data-tanda]'))){verTanda(el.dataset.tanda,el.dataset.tn);return}
  if((el=t.closest('[data-rt]'))){RF={tipo:el.dataset.rt,page:0,admin:false};rerender();return}
  if(t.closest('[data-radmin]')){RF={tipo:'',page:0,admin:true};rerender();return}
  if((el=t.closest('[data-rvres]'))){resolverRev(el.dataset.rvres,el.dataset.st);return}
  if((el=t.closest('[data-rvopen],[data-rvopen2]'))){var x=RV.find(function(r){return r.id===(el.dataset.rvopen||el.dataset.rvopen2)});
    var id=el.dataset.rvopen2?await empresaDeClave('empresas',x.relacionada_clave):await empresaDeClave(x.entidad,x.entidad_clave,x.datos);
    if(id)openFicha(id);else if(x.entidad==='ejecuciones'){RF={tipo:'',page:0,admin:true};rerender()}else toast('No hay una empresa vinculada a este ítem.','warn');return}
  if((el=t.closest('[data-ejec]'))){var r=await q(sb.from('crm_ejecuciones').select('*').eq('id',el.dataset.ejec).single());var d=r.data;
    modal('<p class="px-eb">Espacio administrativo · '+esc(d.tipo)+'</p><h3 style="font-size:18px">'+esc(d.titulo||d.clave)+'</h3><p class="faint">'+(d.fecha?esc(fdt(d.fecha)):'Fecha sin verificar')+' · '+link(d.fuente_url,'origen')+'</p><pre class="orig">'+esc(d.texto_original||d.detalle||'')+'</pre><div class="acts"><button class="px-btn g sm" data-close>Cerrar</button></div>');return}
  if(t.closest('#btnDatos')){$('#menu').hidden=!$('#menu').hidden;return}
  if(!t.closest('#menu'))$('#menu').hidden=true;
  if((el=t.closest('#menu [data-act]'))){$('#menu').hidden=true;var a=el.dataset.act;
    if(a==='exportar')exportar();if(a==='formato')formato();if(a==='logout'){await sb.auth.signOut();location.reload()}return}
  if(t.closest('#btnNueva')){nuevaEmpresa();return}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(!$('#modal').hidden)closeModal();else if(F)closeFicha()}});
$('#fileImport').addEventListener('change',function(){var f=this.files[0];this.value='';$('#menu').hidden=true;if(f)importar(f)});

/* ---------- ingreso ---------- */
function showLogin(msg){$('#login').hidden=false;$('#loginMsg').textContent=msg||'';setSync('bad','Sin sesión')}
async function enter(){
  setSync('busy','Cargando');
  var a=await sb.from('crm_admins').select('email').limit(1);
  if(a.error||!a.data||!a.data.length){await sb.auth.signOut();showLogin('Este usuario no tiene acceso al CRM.');return}
  var s=await sb.auth.getSession();me=(s.data.session&&s.data.session.user.email)||'';
  $('#login').hidden=true;setSync('ok','Conectado');refreshRevCnt();
  var h=(location.hash||'#hoy').slice(1).split('/');show(h[0]||'hoy');if(h[1]==='e'&&h[2])openFicha(h[2]);
}
$('#loginForm').addEventListener('submit',async function(e){e.preventDefault();$('#loginMsg').textContent='';
  var r=await sb.auth.signInWithPassword({email:$('#lgEmail').value.trim(),password:$('#lgPass').value});
  if(r.error){$('#loginMsg').textContent='Email o contraseña incorrectos.';return}enter()});
(async function boot(){
  if(!window.supabase){setSync('bad','Sin conexión');toast('No se pudo cargar la conexión con la base.','bad');return}
  sb=window.supabase.createClient(SB_URL,SB_KEY);
  var s=await sb.auth.getSession();if(s.data.session)enter();else showLogin();
})();
})();
