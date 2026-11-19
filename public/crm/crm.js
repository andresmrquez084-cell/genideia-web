/* CRM GENIDEIA. Sin dependencias. Los datos viven en localStorage. */
(function(){
'use strict';

/* ---------- modelo ---------- */
// Estados del sistema de prospección (02-prospectos/sistema/01-estados-y-metricas.md)
var STAGES=[
  {id:'0',name:'Sin contactar',c:'#8C96A8',hint:'Primer mensaje.'},
  {id:'1',name:'Contactado sin identificar',short:'Contactado',c:'#9FB3FF',hint:'Solo mensajes cortos para saber quién lee.'},
  {id:'2',name:'Rol identificado',c:'#38D6FF',hint:'Ejemplo breve (30 a 60 s) y pregunta de proceso.'},
  {id:'3',name:'Momento acordado',c:'#00C8FF',hint:'Confirmación y material corto previo.'},
  {id:'4',name:'Diagnóstico hecho',c:'#5AA9FF',hint:'Prototipo o ejemplo específico.'},
  {id:'5',name:'Prioridad reconocida',c:'#B79CFF',hint:'Propuesta y precio.'},
  {id:'6',name:'Propuesta presentada',c:'#FFB84D',hint:'Seguimiento por señal.'},
  {id:'7',name:'Cierre',c:'#4BE39A',hint:'Acuerdo firmado.'},
  {id:'P',name:'Pausa con fecha',short:'Pausa',c:'#D7B4FF',hint:'Re-contacto en la fecha acordada.'},
  {id:'D',name:'Descartado',c:'#FF6B7A',hint:'No aplica o rechazo explícito.'}
];
var SM={};STAGES.forEach(function(s,i){s.i=i;SM[s.id]=s});
var ROLES={decide:'Decide',usa:'Usa',influye:'Influye',filtra:'Filtra'};
var CHANNELS=['WhatsApp','Llamada','Email','Reunión','Visita','Instagram','LinkedIn'];
var MATERIAL=[
  {id:'',name:'Solo mensaje'},
  {id:'corto',name:'Ejemplo breve'},
  {id:'video',name:'Video largo',heavy:true},
  {id:'prototipo',name:'Prototipo',heavy:true},
  {id:'propuesta',name:'Propuesta o precio',heavy:true}
];
var MM={};MATERIAL.forEach(function(m){MM[m.id]=m});
var KEY='genideia-crm-v1';

function num(id){var n=parseInt(id,10);return isNaN(n)?-1:n}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function addDays(iso,n){var d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
var MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fmt(iso){if(!iso)return '';var d=new Date(iso.slice(0,10)+'T12:00:00');return d.getDate()+' '+MES[d.getMonth()]}
function rel(iso){
  if(!iso)return '';var t=today(),d=Math.round((new Date(iso.slice(0,10)+'T12:00:00')-new Date(t+'T12:00:00'))/864e5);
  if(d===0)return 'hoy';if(d===1)return 'mañana';if(d===-1)return 'ayer';
  return d<0?'hace '+(-d)+' d':'en '+d+' d';
}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function initials(n){return String(n||'?').trim().split(/\s+/).slice(0,2).map(function(w){return w[0]}).join('').toUpperCase()}
function money(v){v=+v||0;return 'USD '+v.toLocaleString('es-UY')}

var db=load();
function load(){
  try{var d=JSON.parse(localStorage.getItem(KEY));if(d&&d.companies)return d}catch(e){}
  return {v:1,companies:[],interactions:[]};
}
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){toast('No se pudo guardar en este navegador. Exportá una copia.','warn')}
}
function co(id){return db.companies.find(function(c){return c.id===id})}
function evsOf(id){return db.interactions.filter(function(e){return e.companyId===id}).sort(function(a,b){return (b.date+b.at).localeCompare(a.date+a.at)})}
function lastTouch(id){var e=evsOf(id)[0];return e?e.date:''}
function mainContact(c){var cs=c.contacts||[];return cs.find(function(x){return x.role==='decide'})||cs[0]}
function isActive(c){var n=num(c.stage);return n>=1&&n<=6}
function newCompany(p){
  var t=new Date().toISOString();
  var c=Object.assign({id:uid(),name:'',segment:'',city:'',phone:'',web:'',value:'',source:'',notes:'',stage:'0',contacts:[],next:{text:'',date:''},pauseDate:'',history:[{stage:'0',at:t}],maxStage:0,createdAt:t,updatedAt:t},p||{});
  if(p&&p.stage){c.history=[{stage:p.stage,at:t}];c.maxStage=Math.max(0,num(p.stage))}
  return c;
}
function touch(c){c.updatedAt=new Date().toISOString();save()}

/* ---------- vistas ---------- */
var view='hoy';
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};

function stp(id,full){var s=SM[id]||SM['0'];return '<span class="stp" style="--sc:'+s.c+'">'+esc(full?s.name:(s.short||s.name))+'</span>'}
function dateChip(iso){if(!iso)return '';var t=today(),cl=iso<t?'late':iso===t?'today':'';return '<span class="dt '+cl+'">'+esc(rel(iso))+'</span>'}
function avatar(c){var s=SM[c.stage]||SM['0'];return '<span class="av" style="background:linear-gradient(135deg,'+s.c+',#2a7bff)">'+esc(initials(c.name))+'</span>'}

function renderAll(){({hoy:renderHoy,pipeline:renderPipeline,empresas:renderEmpresas,metricas:renderMetricas})[view]()}
function show(v){
  view=v;
  $$('.tabs button').forEach(function(b){b.classList.toggle('on',b.dataset.view===v)});
  $$('.view').forEach(function(s){s.classList.toggle('on',s.id==='v-'+v)});
  renderAll();
  try{history.replaceState(null,'','#'+v)}catch(e){}
}

function emptyState(msg){
  return '<div class="empty">'+msg+'<div><button class="btn btn-p xs" data-new>Nueva empresa</button> <button class="btn btn-g xs" data-demo>Ver con datos de ejemplo</button></div></div>';
}

/* Hoy */
function renderHoy(){
  var t=today(),cs=db.companies;
  var withNext=cs.filter(function(c){return c.next&&c.next.date&&c.stage!=='D'&&c.stage!=='7'});
  var late=withNext.filter(function(c){return c.next.date<t}).sort(byNext);
  var now=withNext.filter(function(c){return c.next.date===t});
  var soon=withNext.filter(function(c){return c.next.date>t&&c.next.date<=addDays(t,7)}).sort(byNext);
  var pauses=cs.filter(function(c){return c.stage==='P'&&c.pauseDate&&c.pauseDate<=addDays(t,3)}).sort(function(a,b){return a.pauseDate.localeCompare(b.pauseDate)});
  var orphan=cs.filter(function(c){return isActive(c)&&!(c.next&&c.next.date)});
  var props=cs.filter(function(c){return c.stage==='6'});
  var month=t.slice(0,7),wins=cs.filter(function(c){return c.stage==='7'&&(c.history||[]).some(function(h){return h.stage==='7'&&h.at.slice(0,7)===month})});
  var h=new Date().getHours(),hi=h<12?'Buen día':h<20?'Buenas tardes':'Buenas noches';
  var html='<div class="vh"><div><span class="eyebrow">'+esc(capital(new Date().toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'})))+'</span>'+
    '<h1>'+hi+', <em>esto es lo de hoy</em></h1><p>'+(late.length+now.length?(late.length+now.length)+' seguimientos para resolver. Empezá por los vencidos.':'No hay seguimientos pendientes para hoy.')+'</p></div></div>';
  html+='<div class="kpis">'+
    kpi('Activas',cs.filter(isActive).length,'en conversación','')+
    kpi('Vencidos',late.length,'seguimientos atrasados',late.length?'bad':'')+
    kpi('Para hoy',now.length,'seguimientos del día',now.length?'warn':'')+
    kpi('Propuestas abiertas',props.length,money(props.reduce(function(s,c){return s+(+c.value||0)},0)),'')+
    kpi('Cierres del mes',wins.length,MES[new Date().getMonth()]+' '+new Date().getFullYear(),wins.length?'ok':'')+
  '</div>';
  if(!cs.length){$('#v-hoy').innerHTML=html+'<div style="margin-top:16px">'+emptyState('Todavía no hay empresas cargadas.')+'</div>';return}
  html+='<div class="cols2"><div class="glass spot box"><h3>Seguimientos <span class="tag">'+(late.length+now.length+soon.length)+'</span></h3><div class="rows">'+
    (late.concat(now,soon).map(rowNext).join('')||'<div class="empty">Nada pendiente en los próximos 7 días.</div>')+'</div></div>'+
    '<div style="display:grid;gap:16px;align-content:start">'+
    '<div class="glass spot box"><h3>Sin próximo paso <span class="tag">'+orphan.length+'</span></h3><div class="rows">'+
      (orphan.slice(0,8).map(function(c){return row(c,'<small>'+esc(SM[c.stage].hint)+'</small>','<span class="dt late">definir</span>')}).join('')||'<div class="empty">Todas las conversaciones activas tienen un próximo paso.</div>')+'</div></div>'+
    (pauses.length?'<div class="glass spot box"><h3>Pausas que vuelven <span class="tag">'+pauses.length+'</span></h3><div class="rows">'+pauses.map(function(c){return row(c,'<small>Re-contacto acordado</small>',dateChip(c.pauseDate))}).join('')+'</div></div>':'')+
    '</div></div>';
  $('#v-hoy').innerHTML=html;
}
function capital(s){return s.charAt(0).toUpperCase()+s.slice(1)}
function byNext(a,b){return a.next.date.localeCompare(b.next.date)}
function kpi(k,v,d,cl){return '<div class="glass spot kpi '+cl+'"><div class="k">'+esc(k)+'</div><div class="v" data-n="'+v+'">'+v+'</div><div class="d">'+esc(d)+'</div></div>'}
function row(c,sub,right){return '<button class="row" data-open="'+c.id+'">'+avatar(c)+'<div><b>'+esc(c.name||'Sin nombre')+'</b>'+sub+'</div>'+right+'</button>'}
function rowNext(c){return row(c,'<small>'+esc(c.next.text||'Seguimiento')+' · '+esc(SM[c.stage].short||SM[c.stage].name)+'</small>',dateChip(c.next.date))}

/* Pipeline */
function renderPipeline(){
  var q=(pipeQ||'').toLowerCase();
  var html='<div class="vh"><div><span class="eyebrow">Embudo de conocimiento</span><h1>Pipeline</h1><p>Cada estado agrega una certeza. Arrastrá las tarjetas para moverlas.</p></div>'+
    '<input class="in" id="pipeQ" placeholder="Buscar empresa" value="'+esc(pipeQ)+'" style="width:min(280px,100%)"></div>';
  if(!db.companies.length){$('#v-pipeline').innerHTML=html+emptyState('El pipeline está vacío.');return}
  html+='<div class="board">'+STAGES.map(function(s){
    var cs=db.companies.filter(function(c){return c.stage===s.id&&(!q||(c.name+' '+c.segment).toLowerCase().indexOf(q)>=0)}).sort(function(a,b){return (a.next.date||'9').localeCompare(b.next.date||'9')});
    var tot=cs.reduce(function(t,c){return t+(+c.value||0)},0);
    return '<div class="col" data-stage="'+s.id+'" style="--sc:'+s.c+'"><div class="col-h"><b><i>'+s.id+'</i>'+esc(s.short||s.name)+'</b><span>'+cs.length+(tot?' · '+money(tot):'')+'</span></div>'+
      '<div class="col-hint">'+esc(s.hint)+'</div><div class="cards">'+cs.map(card).join('')+'</div></div>';
  }).join('')+'</div>';
  $('#v-pipeline').innerHTML=html;
  bindDnD();
}
var pipeQ='';
function card(c){
  var mc=mainContact(c),s=SM[c.stage];
  return '<div class="cc" draggable="true" data-id="'+c.id+'" data-open="'+c.id+'" style="--sc:'+s.c+'"><b>'+esc(c.name||'Sin nombre')+'</b>'+
    '<small>'+esc([c.segment,mc?mc.name+(mc.role?' ('+ROLES[mc.role]+')':''):'Sin contacto'].filter(Boolean).join(' · '))+'</small>'+
    '<div class="meta">'+(c.next&&c.next.date?dateChip(c.next.date):'')+(c.stage==='P'&&c.pauseDate?'<span class="dt">vuelve '+esc(fmt(c.pauseDate))+'</span>':'')+(c.value?'<span class="val">'+money(c.value)+'</span>':'')+'</div></div>';
}
function bindDnD(){
  var dragId=null;
  $$('.cc').forEach(function(el){
    el.addEventListener('dragstart',function(e){dragId=el.dataset.id;el.classList.add('drag');e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',dragId)}catch(_){}});
    el.addEventListener('dragend',function(){el.classList.remove('drag');$$('.col.over').forEach(function(c){c.classList.remove('over')})});
  });
  $$('.col').forEach(function(col){
    col.addEventListener('dragover',function(e){e.preventDefault();col.classList.add('over')});
    col.addEventListener('dragleave',function(e){if(!col.contains(e.relatedTarget))col.classList.remove('over')});
    col.addEventListener('drop',function(e){e.preventDefault();col.classList.remove('over');if(dragId)moveStage(dragId,col.dataset.stage)});
  });
}

/* Cambio de estado con las reglas de tránsito */
function moveStage(id,to,force){
  var c=co(id);if(!c||c.stage===to)return;
  var from=num(c.stage),n=num(to);
  if(!force){
    var warn='';
    if(n>=2&&n<=7&&!(c.contacts||[]).some(function(x){return x.role}))warn='Todavía no sabés quién decide. El estado 2 pide nombre y rol.';
    else if(n>=5&&n<=7&&from>=0&&from<4)warn='No se salta a propuesta sin diagnóstico. Primero pasá por el estado 4.';
    if(warn){toast(warn,'warn',{label:'Mover igual',fn:function(){moveStage(id,to,true)}});return}
  }
  c.stage=to;
  c.history=(c.history||[]).concat({stage:to,at:new Date().toISOString()});
  c.maxStage=Math.max(c.maxStage||0,n);
  if(to==='P'&&!c.pauseDate)c.pauseDate=addDays(today(),30);
  touch(c);renderAll();
  if(drawerId===id)renderDrawer();
  toast(esc(c.name||'Empresa')+' pasó a '+esc(SM[to].name));
}

/* Empresas */
var fq='',fs='',fseg='';
function renderEmpresas(){
  var segs=uniq(db.companies.map(function(c){return c.segment}).filter(Boolean)).sort();
  var html='<div class="vh"><div><span class="eyebrow">Base</span><h1>Empresas</h1><p>'+db.companies.length+' empresas, '+db.interactions.length+' interacciones registradas.</p></div></div>'+
    '<div class="filters"><input class="in q" id="fq" placeholder="Buscar por empresa, contacto o ciudad" value="'+esc(fq)+'">'+
    '<select class="in" id="fs"><option value="">Todos los estados</option>'+STAGES.map(function(s){return '<option value="'+s.id+'"'+(fs===s.id?' selected':'')+'>'+s.id+' · '+esc(s.name)+'</option>'}).join('')+'</select>'+
    '<select class="in" id="fseg"><option value="">Todos los segmentos</option>'+segs.map(function(s){return '<option'+(fseg===s?' selected':'')+'>'+esc(s)+'</option>'}).join('')+'</select></div>';
  if(!db.companies.length){$('#v-empresas').innerHTML=html+emptyState('No hay empresas todavía.');bindFilters();return}
  var q=fq.toLowerCase();
  var list=db.companies.filter(function(c){
    if(fs&&c.stage!==fs)return false;if(fseg&&c.segment!==fseg)return false;
    if(!q)return true;
    return [c.name,c.segment,c.city,c.notes].concat((c.contacts||[]).map(function(x){return x.name})).join(' ').toLowerCase().indexOf(q)>=0;
  }).sort(function(a,b){return b.updatedAt.localeCompare(a.updatedAt)});
  html+='<table class="tbl"><thead><tr><th>Empresa</th><th>Estado</th><th>Contacto</th><th>Próximo paso</th><th>Último toque</th></tr></thead><tbody>'+
    list.map(function(c){var mc=mainContact(c),lt=lastTouch(c.id);
      return '<tr data-open="'+c.id+'"><td><b>'+esc(c.name||'Sin nombre')+'</b><div class="faint">'+esc([c.segment,c.city].filter(Boolean).join(' · '))+'</div></td>'+
        '<td>'+stp(c.stage)+'</td>'+
        '<td class="'+(mc?'':'hm')+'">'+(mc?esc(mc.name)+(mc.role?' <span class="faint">'+ROLES[mc.role]+'</span>':''):'<span class="faint">Sin identificar</span>')+'</td>'+
        '<td class="'+(c.next&&c.next.date?'':'hm')+'">'+(c.next&&c.next.date?dateChip(c.next.date)+' <span class="faint">'+esc(c.next.text)+'</span>':'<span class="faint">Sin definir</span>')+'</td>'+
        '<td class="hm faint">'+(lt?esc(rel(lt)):'Nunca')+'</td></tr>'}).join('')+
    '</tbody></table>'+(list.length?'':'<div class="empty">Ninguna empresa coincide con el filtro.</div>');
  $('#v-empresas').innerHTML=html;
  bindFilters();
}
function bindFilters(){
  var a=$('#fq');if(a)a.addEventListener('input',function(){fq=a.value;var p=a.selectionStart;renderEmpresas();var b=$('#fq');b.focus();b.setSelectionRange(p,p)});
  var s=$('#fs');if(s)s.addEventListener('change',function(){fs=s.value;renderEmpresas()});
  var g=$('#fseg');if(g)g.addEventListener('change',function(){fseg=g.value;renderEmpresas()});
}
function uniq(a){return a.filter(function(x,i){return a.indexOf(x)===i})}

/* Métricas */
function renderMetricas(){
  var cs=db.companies,ev=db.interactions;
  var html='<div class="vh"><div><span class="eyebrow">Qué funciona</span><h1>Métricas</h1><p>El estado mide cuánto sabés del prospecto, no cuánto material mandaste.</p></div></div>';
  if(!cs.length){$('#v-metricas').innerHTML=html+emptyState('Sin datos para medir todavía.');return}
  var out=ev.filter(function(e){return e.dir==='out'}),inn=ev.filter(function(e){return e.dir==='in'});
  var contacted=uniq(out.map(function(e){return e.companyId})),replied=uniq(inn.map(function(e){return e.companyId}));
  var rate=contacted.length?Math.round(replied.filter(function(id){return contacted.indexOf(id)>=0}).length/contacted.length*100):0;
  var reached=function(n){return cs.filter(function(c){return (c.maxStage||0)>=n}).length};
  var diag=reached(4),closed=reached(7);
  html+='<div class="kpis">'+kpi('Tasa de respuesta',rate+'%',replied.length+' de '+contacted.length+' contactadas','')+
    kpi('Llegaron a diagnóstico',diag,'estado 4 o más','')+
    kpi('Diagnóstico a cierre',diag?Math.round(closed/diag*100)+'%':'0%',closed+' cierres','ok')+
    kpi('Toques registrados',ev.length,'últimos 30 días: '+ev.filter(function(e){return e.date>=addDays(today(),-30)}).length,'')+'</div>';
  var mx=Math.max.apply(null,STAGES.slice(0,8).map(function(s){return reached(num(s.id))}).concat(1));
  html+='<div class="cols2"><div class="glass spot box"><h3>Embudo <span class="tag">empresas que alcanzaron cada estado</span></h3><div class="funnel">'+
    STAGES.slice(0,8).map(function(s,i){var v=reached(num(s.id));return '<div class="fr" style="--sc:'+s.c+'"><span>'+s.id+' · '+esc(s.short||s.name)+'</span><div class="bar"><i style="width:'+(v/mx*100)+'%;animation-delay:'+(i*60)+'ms"></i></div><span class="n">'+v+'</span></div>'}).join('')+'</div></div>';
  // por canal: respuestas sobre envíos
  var byCh=CHANNELS.map(function(ch){var o=uniq(out.filter(function(e){return e.channel===ch}).map(function(e){return e.companyId}));var r=uniq(inn.filter(function(e){return e.channel===ch}).map(function(e){return e.companyId})).filter(function(id){return o.indexOf(id)>=0});return {ch:ch,o:o.length,r:r.length}}).filter(function(x){return x.o});
  html+='<div style="display:grid;gap:16px;align-content:start"><div class="glass spot box"><h3>Respuesta por canal</h3><div class="funnel">'+
    (byCh.map(function(x){var p=Math.round(x.r/x.o*100);return '<div class="fr" style="--sc:#38D6FF"><span>'+esc(x.ch)+' <span class="faint">'+x.r+'/'+x.o+'</span></span><div class="bar"><i style="width:'+p+'%"></i></div><span class="n">'+p+'%</span></div>'}).join('')||'<div class="empty">Registrá mensajes enviados y recibidos para ver esto.</div>')+'</div></div>';
  // toques por semana, últimas 12
  var weeks=[],t=today();for(var w=11;w>=0;w--){var a=addDays(t,-(w*7+6)),b=addDays(t,-w*7);weeks.push(ev.filter(function(e){return e.date>=a&&e.date<=b}).length)}
  var wm=Math.max.apply(null,weeks.concat(1));
  html+='<div class="glass spot box"><h3>Toques por semana <span class="tag">12 semanas</span></h3><div class="spark">'+weeks.map(function(v,i){return '<i title="'+v+'" style="height:'+(v/wm*100)+'%;animation-delay:'+(i*40)+'ms"></i>'}).join('')+'</div><div class="xl2"><span>hace 12 sem</span><span>esta semana</span></div></div>';
  html+='</div></div>';
  $('#v-metricas').innerHTML=html;
}

/* ---------- ficha ---------- */
var drawerId=null,evDraft={dir:'out',channel:'WhatsApp',material:''},confirmHeavy=false,confirmDel=false;
function openDrawer(id){
  drawerId=id;confirmHeavy=false;confirmDel=false;
  renderDrawer();
  $('#drawerBg').hidden=false;
  setTimeout(function(){$('#drawer').classList.add('open');$('#drawer').setAttribute('aria-hidden','false')},16);
}
function closeDrawer(){
  drawerId=null;$('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true');$('#drawerBg').hidden=true;renderAll();
}
function renderDrawer(){
  var c=co(drawerId);if(!c){closeDrawer();return}
  var s=SM[c.stage],evs=evsOf(c.id),n=num(c.stage);
  var mat=MM[evDraft.material]||MM[''],heavyWarn=mat.heavy&&n<3&&n>=0;
  var x='<div class="dh"><div><span class="eyebrow">'+esc(c.segment||'Empresa')+'</span><h2>'+esc(c.name||'Nueva empresa')+'</h2></div><button class="x" data-close aria-label="Cerrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>';
  // estado
  x+='<div class="ds"><h4>Estado</h4><div class="stages">'+STAGES.map(function(st){return '<button data-stage="'+st.id+'" class="'+(st.id===c.stage?'on':'')+'" style="--sc:'+st.c+'">'+st.id+' · '+esc(st.short||st.name)+'</button>'}).join('')+'</div>'+
    '<div class="hint"><b>Qué habilita:</b> '+esc(s.hint)+(n>=0&&n<3?' No mandes video largo, prototipo ni propuesta todavía.':'')+'</div>'+
    (c.stage==='P'?'<label class="f" style="margin-top:10px"><span>Fecha de re-contacto</span><input class="in" type="date" data-f="pauseDate" value="'+esc(c.pauseDate)+'"></label>':'')+'</div>';
  // próximo paso
  x+='<div class="ds"><h4>Próximo paso</h4><div class="fg"><label class="f full"><span>Qué hay que hacer</span><input class="in" data-n="text" placeholder="Ej.: preguntar quién se encarga de los pedidos" value="'+esc(c.next.text)+'"></label>'+
    '<label class="f"><span>Cuándo</span><input class="in" type="date" data-n="date" value="'+esc(c.next.date)+'"></label>'+
    '<div class="f"><span>Atajos</span><div class="acts" style="margin:0">'+[['Mañana',1],['3 días',3],['1 semana',7]].map(function(a){return '<button class="btn btn-g xs" data-quick="'+a[1]+'">'+a[0]+'</button>'}).join('')+'</div></div></div></div>';
  // registrar interacción
  x+='<div class="ds"><h4>Registrar toque</h4>'+
    '<div class="acts" style="margin-top:0"><div class="seg" data-seg="dir"><button data-v="out" class="'+(evDraft.dir==='out'?'on':'')+'">Envié</button><button data-v="in" class="'+(evDraft.dir==='in'?'on':'')+'">Respondió</button></div>'+
    '<select class="in" data-ev="channel" style="height:38px">'+CHANNELS.map(function(ch){return '<option'+(evDraft.channel===ch?' selected':'')+'>'+ch+'</option>'}).join('')+'</select>'+
    (evDraft.dir==='out'?'<select class="in" data-ev="material" style="height:38px">'+MATERIAL.map(function(m){return '<option value="'+m.id+'"'+(evDraft.material===m.id?' selected':'')+'>'+m.name+'</option>'}).join('')+'</select>':'')+'</div>'+
    '<textarea class="in" id="evText" placeholder="Qué pasó, qué dijo, qué aprendiste" style="width:100%;margin-top:10px">'+esc(evDraft.text||'')+'</textarea>'+
    (heavyWarn&&evDraft.dir==='out'?'<div class="warnbox">Regla: no se manda '+esc(mat.name.toLowerCase())+' antes del estado 3. Si no sabés quién lo recibe, no sabés quién lo va a evaluar.</div>':'')+
    '<div class="acts"><button class="btn btn-p xs" data-addev>'+(heavyWarn&&evDraft.dir==='out'&&confirmHeavy?'Registrar igual':'Registrar')+'</button><input class="in" type="date" id="evDate" value="'+(evDraft.date||today())+'" style="height:32px;font-size:13px"></div></div>';
  // historial
  x+='<div class="ds"><h4>Historial <span>'+evs.length+'</span></h4>'+(evs.length?'<div class="tline">'+evs.map(function(e){
    return '<div class="ev '+(e.dir==='in'?'in-dir':'')+'"><div class="eh"><span>'+esc(fmt(e.date))+'</span><span>'+(e.dir==='in'?'Respondió':'Envié')+' por '+esc(e.channel)+'</span>'+(e.material?'<span class="dt">'+esc(MM[e.material]?MM[e.material].name:e.material)+'</span>':'')+'<button class="rm" data-rmev="'+e.id+'" aria-label="Borrar toque">×</button></div>'+(e.text?'<p>'+esc(e.text)+'</p>':'')+'</div>'}).join('')+'</div>':'<div class="empty">Sin toques registrados.</div>')+'</div>';
  // contactos
  x+='<div class="ds"><h4>Contactos <span>'+(c.contacts||[]).length+'</span></h4><div class="rows">'+(c.contacts||[]).map(function(p){
    var wa=(p.phone||'').replace(/\D/g,'');
    return '<div class="ct"><span class="av">'+esc(initials(p.name))+'</span><div><b>'+esc(p.name)+'</b><small>'+esc([p.role?ROLES[p.role]:'Rol sin definir',p.title,p.phone].filter(Boolean).join(' · '))+'</small></div>'+
      '<div style="display:flex;gap:4px">'+(wa?'<a class="btn btn-wa xs" href="https://wa.me/'+wa+'" target="_blank" rel="noopener">WhatsApp</a>':'')+'<button class="rm" data-rmct="'+p.id+'" aria-label="Quitar contacto">×</button></div></div>'}).join('')+'</div>'+
    '<div class="fg" style="margin-top:10px"><input class="in" id="ctName" placeholder="Nombre"><select class="in" id="ctRole"><option value="">Rol</option>'+Object.keys(ROLES).map(function(k){return '<option value="'+k+'">'+ROLES[k]+'</option>'}).join('')+'</select>'+
    '<input class="in" id="ctTitle" placeholder="Cargo"><input class="in" id="ctPhone" placeholder="Teléfono" inputmode="tel"></div><div class="acts"><button class="btn btn-g xs" data-addct>Agregar contacto</button></div></div>';
  // datos
  x+='<div class="ds"><h4>Datos</h4><div class="fg">'+
    fld('name','Empresa','full')+fld('segment','Segmento o rubro')+fld('city','Ciudad o zona')+fld('phone','Teléfono general')+fld('web','Web o Instagram')+
    fld('value','Valor estimado (USD)','','number')+fld('source','Origen del lead')+
    '<label class="f full"><span>Notas</span><textarea class="in" data-f="notes" placeholder="Recorrido, volumen, quién ejecuta">'+esc(c.notes)+'</textarea></label></div></div>';
  x+='<div class="ds"><div class="acts" style="margin:0;justify-content:space-between"><span class="faint" style="font-size:12px">Creada '+esc(fmt(c.createdAt))+' · actualizada '+esc(rel(c.updatedAt))+'</span><button class="btn btn-d xs" data-del>'+(confirmDel?'Confirmar: borrar empresa':'Borrar empresa')+'</button></div></div>';
  $('#drawer').innerHTML=x;
  function fld(k,l,cl,type){return '<label class="f '+(cl||'')+'"><span>'+l+'</span><input class="in" '+(type?'type="'+type+'" ':'')+'data-f="'+k+'" value="'+esc(c[k])+'"></label>'}
}

/* ---------- eventos ---------- */
document.addEventListener('click',function(e){
  var t=e.target;
  var tab=t.closest('.tabs button');if(tab){show(tab.dataset.view);return}
  if(t.closest('#btnNew')){var c=newCompany();db.companies.unshift(c);save();openDrawer(c.id);setTimeout(function(){var i=$('[data-f="name"]');if(i){i.scrollIntoView({block:'center'});i.focus()}},420);return}
  if(t.closest('[data-new]')){$('#btnNew').click();return}
  if(t.closest('[data-demo]')){loadDemo();return}
  if(t.closest('#btnMenu')){$('#menu').hidden=!$('#menu').hidden;return}
  if(!t.closest('#menu'))$('#menu').hidden=true;
  var ma=t.closest('#menu [data-act]');
  if(ma&&ma.tagName==='BUTTON'){menuAct(ma.dataset.act);return}
  var tb=t.closest('.toast button');if(tb&&toastFn){var f=toastFn;hideToast();f();return}
  if(t.closest('#drawerBg')||t.closest('[data-close]')){closeDrawer();return}
  var op=t.closest('[data-open]');if(op&&!t.closest('#drawer')){openDrawer(op.dataset.open);return}
  // dentro de la ficha
  if(!drawerId)return;
  var c=co(drawerId);
  var sb=t.closest('.stages button');if(sb){moveStage(c.id,sb.dataset.stage);return}
  var qk=t.closest('[data-quick]');if(qk){c.next.date=addDays(today(),+qk.dataset.quick);touch(c);renderDrawer();return}
  var sg=t.closest('.seg button');if(sg){evDraft[sg.parentNode.dataset.seg]=sg.dataset.v;keepText();confirmHeavy=false;renderDrawer();return}
  if(t.closest('[data-addev]')){addEvent(c);return}
  var rv=t.closest('[data-rmev]');if(rv){db.interactions=db.interactions.filter(function(x){return x.id!==rv.dataset.rmev});touch(c);keepText();renderDrawer();toast('Toque borrado');return}
  if(t.closest('[data-addct]')){
    var nm=$('#ctName').value.trim();if(!nm){$('#ctName').focus();return}
    c.contacts=(c.contacts||[]).concat({id:uid(),name:nm,role:$('#ctRole').value,title:$('#ctTitle').value.trim(),phone:$('#ctPhone').value.trim()});
    touch(c);keepText();renderDrawer();toast('Contacto agregado');return;
  }
  var rc=t.closest('[data-rmct]');if(rc){c.contacts=c.contacts.filter(function(x){return x.id!==rc.dataset.rmct});touch(c);keepText();renderDrawer();return}
  if(t.closest('[data-del]')){
    if(!confirmDel){confirmDel=true;keepText();renderDrawer();return}
    db.companies=db.companies.filter(function(x){return x.id!==c.id});db.interactions=db.interactions.filter(function(x){return x.companyId!==c.id});save();closeDrawer();toast('Empresa borrada');return;
  }
});
function keepText(){var a=$('#evText');if(a)evDraft.text=a.value;var d=$('#evDate');if(d)evDraft.date=d.value}
function addEvent(c){
  keepText();
  var mat=MM[evDraft.material]||MM[''],n=num(c.stage);
  if(evDraft.dir==='out'&&mat.heavy&&n>=0&&n<3&&!confirmHeavy){confirmHeavy=true;renderDrawer();return}
  db.interactions.push({id:uid(),companyId:c.id,date:evDraft.date||today(),at:new Date().toISOString(),dir:evDraft.dir,channel:evDraft.channel,material:evDraft.dir==='out'?evDraft.material:'',text:(evDraft.text||'').trim()});
  // el primer envío saca a la empresa de "Sin contactar"
  var auto=c.stage==='0'&&evDraft.dir==='out';
  if(auto){c.stage='1';c.history.push({stage:'1',at:new Date().toISOString()});c.maxStage=Math.max(c.maxStage||0,1)}
  evDraft.text='';evDraft.date='';confirmHeavy=false;
  touch(c);renderDrawer();
  toast(auto?'Toque registrado. Pasó a Contactado.':'Toque registrado. Definí el próximo paso.');
}
var saveT;
document.addEventListener('input',function(e){
  var t=e.target;if(!drawerId||!t.closest('#drawer'))return;
  var c=co(drawerId);
  if(t.dataset.f){c[t.dataset.f]=t.value;if(t.dataset.f==='name'){var h=$('#drawer .dh h2');if(h)h.textContent=t.value||'Nueva empresa'}}
  else if(t.dataset.n){c.next[t.dataset.n]=t.value}
  else if(t.dataset.ev){keepText();evDraft[t.dataset.ev]=t.value;confirmHeavy=false;if(t.dataset.ev==='material')renderDrawer();return}
  else return;
  clearTimeout(saveT);saveT=setTimeout(function(){touch(c)},250);
});
document.addEventListener('change',function(e){var t=e.target;if(t.closest('#menu')&&t.type==='file'&&t.files[0]){fileAct(t.dataset.act,t.files[0]);t.value='';$('#menu').hidden=true}});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(drawerId)closeDrawer();$('#menu').hidden=true}});
document.addEventListener('input',function(e){if(e.target.id==='pipeQ'){pipeQ=e.target.value;var p=e.target.selectionStart;renderPipeline();var b=$('#pipeQ');b.focus();b.setSelectionRange(p,p)}});

/* ---------- datos: exportar, importar, ejemplo ---------- */
function menuAct(a){
  $('#menu').hidden=true;
  if(a==='export'){
    var blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'});
    var l=document.createElement('a');l.href=URL.createObjectURL(blob);l.download='crm-genideia-'+today()+'.json';l.click();setTimeout(function(){URL.revokeObjectURL(l.href)},2000);
    toast('Copia descargada');
  }
  if(a==='demo')loadDemo();
  if(a==='wipe')toast('Se borran todas las empresas de este navegador.','warn',{label:'Borrar todo',fn:function(){db={v:1,companies:[],interactions:[]};save();renderAll();toast('Datos borrados')}});
}
function fileAct(a,f){
  var r=new FileReader();
  r.onload=function(){
    try{
      if(a==='import'){
        var d=JSON.parse(r.result);if(!d||!Array.isArray(d.companies))throw 0;
        toast('Reemplaza los datos actuales por los de la copia ('+d.companies.length+' empresas).','warn',{label:'Reemplazar',fn:function(){db=d;db.interactions=db.interactions||[];save();renderAll();toast('Copia importada')}});
      }
      if(a==='csv'){var n=importCSV(r.result);save();renderAll();toast(n+' empresas importadas')}
    }catch(err){toast('El archivo no tiene el formato esperado.','warn')}
  };
  r.readAsText(f);
}
function parseCSV(s){
  var rows=[],row=[],v='',q=false,sep=(s.split('\n')[0].split(';').length>s.split('\n')[0].split(',').length)?';':',';
  for(var i=0;i<s.length;i++){var ch=s[i];
    if(q){if(ch==='"'){if(s[i+1]==='"'){v+='"';i++}else q=false}else v+=ch}
    else if(ch==='"')q=true;else if(ch===sep){row.push(v);v=''}else if(ch==='\n'){row.push(v);rows.push(row);row=[];v=''}else if(ch!=='\r')v+=ch;
  }
  if(v||row.length){row.push(v);rows.push(row)}
  return rows.filter(function(r){return r.some(function(x){return x.trim()})});
}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim()}
function importCSV(text){
  var rows=parseCSV(text);if(rows.length<2)throw 0;
  var H=rows[0].map(norm),find=function(keys){for(var i=0;i<H.length;i++)for(var k=0;k<keys.length;k++)if(H[i].indexOf(keys[k])>=0)return i;return -1};
  var ix={name:find(['empresa','nombre','razon']),segment:find(['segmento','rubro','nicho']),city:find(['ciudad','zona','localidad']),phone:find(['telefono','whatsapp','celular']),web:find(['web','instagram','sitio']),contact:find(['contacto','persona']),role:find(['rol','cargo']),stage:find(['estado','etapa']),notes:find(['nota','observ','comentario'])};
  if(ix.name<0)throw 0;
  var names={};db.companies.forEach(function(c){names[norm(c.name)]=1});
  var n=0;
  rows.slice(1).forEach(function(r){
    var g=function(k){return ix[k]>=0?(r[ix[k]]||'').trim():''};
    var nm=g('name');if(!nm||names[norm(nm)])return;names[norm(nm)]=1;
    var c=newCompany({name:nm,segment:g('segment'),city:g('city'),phone:g('phone'),web:g('web'),notes:g('notes'),stage:mapStage(g('stage')),source:'Importado CSV'});
    if(g('contact')){var rl=norm(g('role'));c.contacts.push({id:uid(),name:g('contact'),role:ROLES[rl]?rl:'',title:ROLES[rl]?'':g('role'),phone:''})}
    db.companies.push(c);n++;
  });
  return n;
}
function mapStage(s){
  var x=norm(s);if(!x)return '0';
  if(SM[x.toUpperCase()])return x.toUpperCase();
  var hit=STAGES.find(function(st){return norm(st.name)===x});if(hit)return hit.id;
  if(x.indexOf('sin contactar')>=0)return '0';
  if(x.indexOf('sin respuesta')>=0||x.indexOf('contactado')>=0)return '1';
  if(x.indexOf('activa')>=0||x.indexOf('convers')>=0)return '1';
  if(x.indexOf('propuesta')>=0)return '6';
  if(x.indexOf('cerr')>=0||x.indexOf('cliente')>=0)return '7';
  if(x.indexOf('pausa')>=0)return 'P';
  if(x.indexOf('descart')>=0||x.indexOf('no aplica')>=0)return 'D';
  return '0';
}
function loadDemo(){
  if(db.companies.some(function(c){return !c.demo})){toast('Ya hay datos reales cargados. Los ejemplos se agregan sin borrar nada.','warn',{label:'Agregar ejemplos',fn:doDemo});return}
  doDemo();
}
function doDemo(){
  var t=today(),mk=function(p,cts,evs){var c=newCompany(Object.assign({demo:true,source:'Ejemplo'},p));c.contacts=cts.map(function(x){return Object.assign({id:uid()},x)});c.maxStage=Math.max(c.maxStage,num(p.stage));db.companies.push(c);
    evs.forEach(function(e){db.interactions.push({id:uid(),companyId:c.id,date:addDays(t,e[0]),at:new Date().toISOString(),dir:e[1],channel:e[2],material:e[3]||'',text:e[4]})})};
  mk({name:'Transportes Ejemplo Sur',segment:'Transporte',city:'Montevideo',stage:'4',value:900,next:{text:'Mandar prototipo del tablero de viajes',date:addDays(t,-1)}},[{name:'Persona de ejemplo A',role:'decide',title:'Dueño'}],[[-12,'out','WhatsApp','','Mensaje de apertura'],[-11,'in','WhatsApp','','Respondió, pidió más info'],[-6,'out','Llamada','','Diagnóstico: 40 viajes por semana, todo en planilla']]);
  mk({name:'Distribuidora Ejemplo Norte',segment:'Distribución',city:'Canelones',stage:'1',next:{text:'Preguntar quién maneja los pedidos',date:t}},[],[[-3,'out','WhatsApp','','Mensaje corto de identificación']]);
  mk({name:'Repuestos Ejemplo',segment:'Repuestos',city:'Montevideo',stage:'6',value:1200,next:{text:'Seguimiento de la propuesta',date:addDays(t,2)}},[{name:'Persona de ejemplo B',role:'decide',title:'Gerente'},{name:'Persona de ejemplo C',role:'usa',title:'Vendedor'}],[[-20,'out','WhatsApp','','Apertura'],[-19,'in','WhatsApp','','Interesado'],[-14,'out','Reunión','','Diagnóstico'],[-5,'out','Email','propuesta','Propuesta enviada']]);
  mk({name:'Clínica Ejemplo',segment:'Salud',city:'Maldonado',stage:'2',next:{text:'Mandar ejemplo de 45 s del asistente',date:addDays(t,1)}},[{name:'Persona de ejemplo D',role:'filtra',title:'Recepción'}],[[-4,'out','Instagram','','Apertura'],[-2,'in','Instagram','','Pasó el contacto de la administración']]);
  mk({name:'Gimnasio Ejemplo',segment:'Gimnasios',city:'Montevideo',stage:'P',pauseDate:addDays(t,2)},[{name:'Persona de ejemplo E',role:'decide'}],[[-30,'out','WhatsApp','','Apertura'],[-29,'in','WhatsApp','','Ahora no, en dos meses sí']]);
  mk({name:'Taller Ejemplo',segment:'Talleres',city:'Paysandú',stage:'0'},[],[]);
  mk({name:'Comercio Ejemplo',segment:'Ecommerce',city:'Salto',stage:'7',value:600},[{name:'Persona de ejemplo F',role:'decide'}],[[-40,'out','WhatsApp','','Apertura'],[-39,'in','WhatsApp','','Respondió'],[-30,'out','Llamada','','Diagnóstico'],[-20,'out','Email','propuesta','Propuesta'],[-15,'in','WhatsApp','','Aceptó']]);
  mk({name:'Hotel Ejemplo',segment:'Hotelería',city:'Colonia',stage:'3',next:{text:'Llamada de diagnóstico',date:addDays(t,4)}},[{name:'Persona de ejemplo G',role:'decide',title:'Encargado'}],[[-8,'out','Llamada','','Apertura'],[-7,'in','Llamada','','Agendamos para el jueves']]);
  save();renderAll();toast('Datos de ejemplo cargados. Se borran desde el menú de datos.');
}

/* ---------- aviso ---------- */
var toastT,toastFn=null;
function toast(msg,kind,action){
  var el=$('#toast');toastFn=action?action.fn:null;
  el.className='toast on '+(kind||'');
  el.innerHTML='<span>'+msg+'</span>'+(action?'<button class="btn btn-g xs">'+esc(action.label)+'</button>':'');
  clearTimeout(toastT);toastT=setTimeout(hideToast,action?7000:2600);
}
function hideToast(){$('#toast').classList.remove('on');toastFn=null}

/* ---------- brillo del cursor (sistema visual) ---------- */
if(matchMedia('(hover: hover) and (pointer: fine)').matches){
  var halo=$('#halo');
  document.addEventListener('pointermove',function(e){
    halo.style.opacity=1;halo.style.transform='translate('+e.clientX+'px,'+e.clientY+'px)';
    var s=e.target.closest&&e.target.closest('.spot');if(s){var r=s.getBoundingClientRect();s.style.setProperty('--mx',(e.clientX-r.left)+'px');s.style.setProperty('--my',(e.clientY-r.top)+'px')}
  },{passive:true});
}

var start=(location.hash||'').slice(1);
show(['hoy','pipeline','empresas','metricas'].indexOf(start)>=0?start:'hoy');
})();
