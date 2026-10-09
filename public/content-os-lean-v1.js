/* Content OS — lean three-module workspace. Presentation only: no destructive migrations. */
(function () {
  'use strict';
  const KEY='genideia-content-os-editorial-v1';
  const now=()=>new Date().toISOString();
  const escapeHtml=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const load=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return {competitors:Array.isArray(x.competitors)?x.competitors:[],plans:Array.isArray(x.plans)?x.plans:[],history:Array.isArray(x.history)?x.history:[]};}catch{return {competitors:[],plans:[],history:[]};}};
  let store=load(), category='Reels', term='', period='';
  const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(store));return true;}catch{return false;}};
  const uid=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2);
  const record=(action,type,id)=>{store.history.unshift({at:now(),action,type,id,source:'Interfaz web'});store.history=store.history.slice(0,500);};
  const friendlyDate=d=>d?new Date(d).toLocaleDateString('es-UY',{day:'2-digit',month:'short',year:'numeric'}):'Sin fecha';
  const field=(name,label,placeholder='',kind='text')=>'<label class="cos-field"><span>'+label+'</span>'+(kind==='textarea'?'<textarea name="'+name+'" placeholder="'+placeholder+'" rows="5"></textarea>':'<input name="'+name+'" type="'+kind+'" placeholder="'+placeholder+'"/>')+'</label>';
  const title=(name,desc,tools='')=>'<div class="cos-lean-head"><div><div class="module-kicker">CONTENT OS / '+name.toUpperCase()+'</div><h2>'+name+'</h2><p>'+desc+'</p></div>'+tools+'</div>';
  const empty=msg=>'<div class="cos-lean-empty">'+msg+'</div>';
  const recordList=(xs,type)=>xs.map(item=>'<article class="cos-lean-record"><div><strong>'+escapeHtml(item.title||item.handle)+'</strong><div class="small-muted">'+escapeHtml(item.topic||item.format||'')+' · '+friendlyDate(item.updatedAt||item.createdAt)+(item.status?' · '+escapeHtml(item.status):'')+'</div>'+(item.url?'<a href="'+escapeHtml(item.url)+'" target="_blank" rel="noopener noreferrer">Ver referencia ↗</a>':'')+'</div><button class="btn ghost" data-edit="'+escapeHtml(item.id)+'" data-kind="'+type+'">Editar</button></article>').join('');
  pages['Competidores']=()=>title('Competidores','Referencias verificables, análisis de ganchos y aprendizajes. No se muestran cuentas ficticias.','<button class="btn" data-new="competitor">+ Referencia</button>')+
    '<div class="cos-lean-controls"><input id="cosQuickFilter" placeholder="Buscar competidor, tema o gancho..." value="'+escapeHtml(term)+'"/></div>'+
    (store.competitors.filter(x=>JSON.stringify(x).toLowerCase().includes(term.toLowerCase())).length?recordList(store.competitors.filter(x=>JSON.stringify(x).toLowerCase().includes(term.toLowerCase())),'competitor'):empty('Todavía no hay referencias guardadas. Agregá un competidor y su video real para iniciar el análisis.'));
  pages['Métricas y estadísticas']=()=>{const posts=typeof published==='function'?published():[];const filtered=posts.filter(x=>{if(!period)return true;const date=new Date(x.timestamp||x.publishedAt||x.date);return !Number.isNaN(+date)&&date.toISOString().slice(0,7)===period;});const total=k=>filtered.reduce((n,x)=>n+(Number(x[k])||0),0);return title('Métricas y estadísticas','Publicaciones y resultados registrados. Se excluyen las piezas todavía no publicadas.')+
    '<div class="cos-lean-controls"><label>Mes (opcional) <input id="cosMetricMonth" type="month" value="'+escapeHtml(period)+'"/></label><span class="chip">'+filtered.length+' publicaciones</span></div>'+
    '<div class="cos-lean-kpis">'+[['Reproducciones',total('views')],['Alcance',total('reach')],['Guardados',total('saves')],['Compartidos',total('shares')],['Seguidores',total('follows')]].map(([l,v])=>'<div class="card panel"><span class="small-muted">'+l+'</span><h2>'+Number(v).toLocaleString('es-UY')+'</h2></div>').join('')+'</div>'+
    (filtered.length?'<div class="card panel cos-scroll"><table class="table"><thead><tr><th>Publicación</th><th>Fecha</th><th>Formato</th><th>Views</th><th>Reach</th><th>Guardados</th><th>Compartidos</th><th>Seguidores</th></tr></thead><tbody>'+filtered.map(p=>'<tr><td>'+escapeHtml(p.title)+'</td><td>'+escapeHtml(p.date||friendlyDate(p.publishedAt))+'</td><td>'+escapeHtml(p.format)+'</td>'+['views','reach','saves','shares','follows'].map(k=>'<td>'+Number(p[k]||0).toLocaleString('es-UY')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':empty('No hay publicaciones para este período. Revisá el filtro o la conexión de Instagram.'))+
    '<p class="small-muted">Los valores provienen del conjunto de publicaciones cargadas en Content OS. Los campos no disponibles se muestran como 0 en los totales, sin estimar cifras.</p>';};
  const kind=(x)=>x.format||'Reels';
  pages['Contenido planificado']=()=>title('Contenido planificado','Guiones, historias y carruseles organizados por fecha, formato, estado y versiones.','<button class="btn" data-new="plan">+ Nueva pieza</button>')+
    '<div class="cos-lean-controls"><div class="cos-lean-segments">'+['Reels','Historias','Carruseles'].map(x=>'<button class="btn '+(category===x?'':'ghost')+'" data-category="'+x+'">'+x+'</button>').join('')+'</div><input id="cosQuickFilter" placeholder="Buscar guion o temática..." value="'+escapeHtml(term)+'"/></div>'+
    (store.plans.filter(x=>kind(x)===category&&JSON.stringify(x).toLowerCase().includes(term.toLowerCase())).length?recordList(store.plans.filter(x=>kind(x)===category&&JSON.stringify(x).toLowerCase().includes(term.toLowerCase())),'plan'):empty('No hay '+category.toLowerCase()+' en este espacio. Cada pieza guardará fecha, estado, texto y versiones.'))+
    '<details class="cos-lean-history"><summary>Historial de ediciones ('+store.history.length+')</summary>'+store.history.slice(0,40).map(x=>'<p>'+friendlyDate(x.at)+' · '+escapeHtml(x.action)+' · '+escapeHtml(x.type)+'</p>').join('')+'</details>';
  navItems.splice(0,navItems.length,['Competidores','◌'],['Métricas y estadísticas','⌁'],['Contenido planificado','▤']);
  currentPage='Métricas y estadísticas';
  let editItem=null;
  function openEditor(type,id){const item=(type==='competitor'?store.competitors:store.plans).find(x=>x.id===id);editItem={type,id};const root=document.getElementById('modalRoot');root.innerHTML='<div class="modal-backdrop"><form class="modal cos-lean-modal" id="cosEditor"><div class="modal-head"><h3>'+(item?'Editar registro':'Nuevo registro')+'</h3><button type="button" class="close" id="cosClose">×</button></div>'+
    (type==='competitor'?field('title','Título de referencia','Ej.: Reel sobre Claude')+field('handle','Competidor','@usuario')+field('url','Enlace al video','https://...','url')+field('topic','Tema')+field('hook','Gancho')+field('promise','Promesa')+field('audience','Público objetivo')+field('analysis','Análisis y aprendizajes','','textarea'):
    field('title','Nombre de la pieza')+'<label class="cos-field"><span>Formato</span><select name="format">'+['Reels','Historias','Carruseles'].map(x=>'<option>'+x+'</option>').join('')+'</select></label><label class="cos-field"><span>Estado</span><select name="status">'+['Idea','En análisis','Guion','Revisión','Aprobado','Programado','Publicado'].map(x=>'<option>'+x+'</option>').join('')+'</select></label>'+field('topic','Tema / carpeta')+field('scheduledAt','Fecha prevista','','date')+field('sourceUrl','Referencia original','https://...','url')+field('body','Guion o secuencia (una diapositiva por párrafo)','','textarea')+field('notes','Observaciones y ajustes','','textarea'))+
    '<div class="cos-lean-buttons"><button class="btn ghost" type="button" id="cosCancel">Cancelar</button><button class="btn" type="submit">Guardar</button></div></form></div>';
    const form=document.getElementById('cosEditor');if(item){Object.keys(item).forEach(key=>{const el=form.elements.namedItem(key);if(el&&'value'in el)el.value=item[key]??'';});}document.getElementById('cosClose').onclick=document.getElementById('cosCancel').onclick=()=>root.innerHTML='';
    form.onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(form));if(!data.title?.trim()){alert('Ingresá un título.');return;}if(data.url&& !/^https?:\/\/.+/i.test(data.url)){alert('El enlace debe empezar con https://');return;}const list=type==='competitor'?store.competitors:store.plans;const updated={...(item||{}),...data,id:item?.id||uid(),createdAt:item?.createdAt||now(),updatedAt:now(),versions:[...(item?.versions||[]),{at:now(),data}]};if(item){list[list.findIndex(x=>x.id===id)]=updated;}else list.unshift(updated);try{const resp=await fetch('/api/content-os/editorial',{method:item?'PATCH':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({...updated,kind:type,expectedRevision:item?.serverRevision})});const result=await resp.json();if(!resp.ok)throw new Error(result.error||'Error al guardar');updated.id=result.record.id;updated.serverRevision=result.record.revision;}catch(error){alert('No se guardó en el servidor: '+error.message);return;}record(item?'Edición':'Creación',type,updated.id);if(!persist()){alert('No se pudo guardar en este navegador. Exportá los datos antes de cerrar.');return;}root.innerHTML='';render();};}
  const oldBind=bindPage;bindPage=function(){oldBind();document.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>openEditor(b.dataset.new,null));document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(b.dataset.kind,b.dataset.edit));document.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>{category=b.dataset.category;render()});const f=document.getElementById('cosQuickFilter');if(f)f.oninput=()=>{term=f.value;const index=f.selectionStart;render();const next=document.getElementById('cosQuickFilter');next?.focus();next?.setSelectionRange(index,index);};const m=document.getElementById('cosMetricMonth');if(m)m.onchange=()=>{period=m.value;render();};};
  const oldRender=render;render=function(){oldRender();document.body.classList.add('cos-lean-mode');};
  // Configuración se conserva como panel secundario, no como cuarta sección.
  const settings=document.createElement('button');settings.id='cosSettings';settings.className='cos-settings';settings.textContent='⚙ Configuración y exportación';document.querySelector('.sidebar-bottom')?.prepend(settings);
  settings.onclick=()=>{const blob=new Blob([JSON.stringify({...store,exportedAt:now()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='content-os-editorial-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);};
  render();
  // Supabase is the authoritative store. Browser cache is only an offline export convenience.
  async function refreshEditorial(){
    try{
      const response=await fetch('/api/content-os/editorial',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok) return;
      const data=await response.json();
      if(!data.ok||!Array.isArray(data.records))return;
      const items=data.records.map(row=>({...row.payload,id:row.id,kind:row.kind,title:row.title,createdAt:row.created_at,updatedAt:row.updated_at,serverRevision:row.revision}));
      store.competitors=items.filter(x=>x.kind==='competitor');
      store.plans=items.filter(x=>x.kind==='plan');
      store.history=(data.history||[]).map(x=>({at:x.created_at,action:x.event,type:x.actor,id:x.record_id}));
      persist();render();
    }catch(error){console.warn('Content OS editorial fetch failed',error);}
  }
  refreshEditorial();
})();