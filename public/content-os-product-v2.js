/* GENIDEIA Content OS — product structure v2 */
(function(){
  const ui={intelligence:'Métricas',strategy:'Ideas',brand:'Personaje'};
  const hiddenDemoStoryIds=new Set([201,202,203]);
  if(Array.isArray(storySequences))storySequences.forEach(s=>{if(hiddenDemoStoryIds.has(s.id)){s.status='Plantilla de ejemplo';s.isTemplate=true;}});

  const esc2=(v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const unclassified=()=>published().filter(v=>!v.topic||v.topic==='Sin clasificar'||!v.hook||v.hook==='Sin clasificar'||v.hook==='Por clasificar');
  const multiSnapshot=()=>published().filter(v=>(v.snapshots||[]).length>=2);
  const realReport=()=>window.ContentOSIntelligence?window.ContentOSIntelligence.report(published()):{observations:[],hypotheses:[],rules:[]};

  function tabs(group,items){const active=ui[group];return `<div class="cos-section-tabs">${items.map(t=>`<button class="cos-section-tab ${active===t?'active':''}" data-os-tab="${group}" data-tab-value="${t}">${t}</button>`).join('')}</div>`;}
  function emptyState(kicker,title,body,action='',go=''){return `<div class="cos-empty"><div class="module-kicker">${kicker}</div><h3>${title}</h3><p>${body}</p>${action?`<button class="btn" data-product-go="${go}">${action}</button>`:''}</div>`;}

  pages['Competencia']=()=>`${header('Competencia','Biblioteca de referencias externas. Solo se muestran piezas realmente guardadas; no usamos competidores ficticios.')} ${emptyState('RADAR EXTERNO','Todavía no hay referencias reales guardadas.','Cuando agreguemos una pieza pública, Content OS registrará su hook, formato, tema, promesa, antigüedad y señales visibles. Nunca va a inventar retención ni métricas privadas de otra cuenta.','Agregar referencias próximamente','Contenido')}`;

  pages['Hipótesis']=()=>{const r=realReport();return `${header('Hipótesis','Señales posibles que todavía necesitan evidencia. Correlación no significa causalidad.')}<div class="module-banner"><div class="module-kicker">EVIDENCE FIRST</div><h3>${r.hypotheses.length?`${r.hypotheses.length} hipótesis activas`:'Todavía no hay una muestra comparable suficiente.'}</h3><p>${r.hypotheses.length?'Cada hipótesis muestra la evidencia disponible, posibles confundentes y qué conviene probar después.':'Primero necesitamos clasificar las publicaciones para comparar piezas equivalentes por formato, hook, tema, promesa, cantidad y nivel.'}</p></div>${r.hypotheses.length?`<div class="grid pattern-grid" style="margin-top:14px">${r.hypotheses.map((h,i)=>`<div class="card panel"><div class="panel-title"><span class="chip amber">H-${String(i+1).padStart(3,'0')}</span><span class="chip">Confianza ${esc2(h.confidence)}</span></div><h3>${esc2(h.statement)}</h3><p class="small-muted"><strong>Evidencia:</strong> ${esc2(h.evidence)}</p><p class="small-muted"><strong>Muestra:</strong> ${esc2(h.sample)} vs ${esc2(h.comparisonSample)}</p><div class="isolation-note"><strong>Qué probar después</strong><br>${esc2(h.nextExperiment)}</div></div>`).join('')}</div>`:''}`;};

  pages['Ideas']=()=>{const missing=unclassified().length;const r=realReport();if(missing)return `${header('Ideas','Recomendaciones construidas desde evidencia real, no desde ejemplos demo.')} ${emptyState('ESTRATEGIA','La cuenta todavía necesita clasificación.','Hay '+missing+' publicaciones sin variables suficientes. Hasta completar esa capa, Content OS no va a fingir que sabe qué idea tiene “94/100” de potencial.','Ir a Contenido','Contenido')}`;const hs=r.hypotheses||[];if(!hs.length)return `${header('Ideas','Recomendaciones construidas desde evidencia real.')} ${emptyState('ESTRATEGIA','Todavía no hay hipótesis útiles para convertir en ideas.','El sistema seguirá acumulando snapshots y comparaciones. Las ideas aparecerán cuando exista evidencia que justifique qué variable conviene repetir o probar.','','')}`;return `${header('Ideas','Próximos tests derivados de hipótesis reales.')}<div class="grid ideas-grid">${hs.slice(0,6).map((h,i)=>`<div class="card idea-card"><div class="pattern-head"><span class="chip amber">HIPÓTESIS</span><span class="chip">${esc2(h.confidence)}</span></div><div class="idea-title">Experimento ${i+1}</div><p class="small-muted">${esc2(h.nextExperiment)}</p><div class="isolation-note"><strong>Por qué</strong><br>${esc2(h.statement)}</div></div>`).join('')}</div>`;};

  pages['Replicar']=()=>{const v=content.find(x=>x.id===selectedId)||published()[0];if(!v)return `${header('Replicar','Usá una pieza real como fuente para diseñar una variante.')} ${emptyState('SIN FUENTE','Todavía no hay contenido seleccionado.','Elegí una publicación real desde Contenido.','Ir a Contenido','Contenido')}`;const classified=v.topic&&v.topic!=='Sin clasificar'&&v.hook&&v.hook!=='Sin clasificar'&&v.hook!=='Por clasificar';return `${header('Replicar','Partí de una publicación real. Las variables se mantienen como observaciones hasta que exista evidencia repetida.',`<button class="btn ghost" data-product-go="Contenido">Cambiar fuente</button>`)}<div class="replicate-layout"><div class="card replicate-source"><div class="panel-title"><h3>Contenido fuente</h3><span class="chip green">Datos reales</span></div>${v.thumbnailUrl?`<div class="cos-reel-preview"><img src="${esc2(v.thumbnailUrl)}" alt=""/></div>`:''}<strong>${esc2(v.title)}</strong><p class="small-muted">${esc2(v.format)} · ${esc2(v.topic)} · ${v.duration?Math.round(v.duration)+'s':'duración no disponible'}</p><div class="metric-grid"><div class="metric-box"><span>Views</span><strong>${fmt(v.views)}</strong></div><div class="metric-box"><span>Save Rate</span><strong>${v.views?pct(rate(v.saves,v.views)):'—'}</strong></div><div class="metric-box"><span>Share Rate</span><strong>${v.views?pct(rate(v.shares,v.views)):'—'}</strong></div><div class="metric-box"><span>Follow Rate</span><strong>${v.views?pct(rate(v.follows,v.views)):'—'}</strong></div></div>${v.permalink?`<a class="btn ghost" href="${esc2(v.permalink)}" target="_blank" rel="noopener" style="display:block;text-align:center;margin-top:12px">Abrir publicación</a>`:''}</div><div class="card panel"><div class="panel-title"><h3>Variables de la pieza</h3><span class="chip ${classified?'green':'amber'}">${classified?'Clasificada':'Falta clasificar'}</span></div>${[['Formato',v.format],['Hook',v.hook],['Tema',v.topic],['Intención',v.intent],['Audiencia',v.audience]].map(([a,b])=>`<div class="variable-row"><span>${a}</span><strong>${esc2(b||'Sin clasificar')}</strong></div>`).join('')}<div class="isolation-note"><strong>${classified?'Punto de partida':'No se generan recomendaciones todavía'}</strong><br>${classified?'Estas variables describen la pieza. Content OS solo propondrá “mantener” una variable cuando la evidencia acumulada lo justifique.':'Primero clasificamos la pieza. Después la comparamos con publicaciones similares antes de recomendar qué mantener y qué cambiar.'}</div></div></div>`;};

  pages['Experimentos']=()=>`${header('Experimentos','Tests controlados diseñados para convertir hipótesis en evidencia.')} ${emptyState('EXPERIMENTACIÓN','Todavía no hay experimentos registrados.','Cuando una hipótesis sea suficientemente interesante, acá definiremos variable a cambiar, variables a mantener, métrica principal y repeticiones necesarias.','','')}`;
  pages['Personaje']=()=>`${header('Personaje','Definición explícita de la identidad que el contenido debe reforzar.')} ${emptyState('MARCA','El personaje todavía no está definido en datos reales.','No usamos el personaje demo del prototipo como si fuera una definición aprobada. Acá vamos a guardar rasgos, pilares, voz, creencias, límites y percepción buscada.','','')}`;
  pages['Percepción']=()=>`${header('Percepción','Qué querés que la audiencia asocie con la marca y cómo lo vamos a medir.')} ${emptyState('PERCEPCIÓN','Todavía no hay una percepción objetivo guardada.','Esta capa se conectará con Stories y contenido para evaluar consistencia entre lo que querés comunicar y lo que efectivamente publicás.','','')}`;
  pages['Brand Fit']=()=>`${header('Brand Fit','Compatibilidad entre cada pieza publicada y la identidad definida.')} ${emptyState('BRAND FIT','Esperando definición de marca + clasificaciones.','El score no aparecerá hasta tener una definición real del personaje y contenido clasificado. No se calcula un porcentaje ficticio.','','')}`;

  pages['Inteligencia']=()=>`${tabs('intelligence',['Métricas','Patrones','Hipótesis','Competencia'])}${pages[ui.intelligence]()}`;
  pages['Estrategia']=()=>`${tabs('strategy',['Ideas','Replicar','Experimentos'])}${pages[ui.strategy]()}`;
  pages['Marca']=()=>`${tabs('brand',['Personaje','Percepción','Brand Fit'])}${pages[ui.brand]()}`;

  navItems.splice(0,navItems.length,['Resumen','⌂'],['Contenido','▣'],['Inteligencia','✦'],['Estrategia','◈'],['Stories','▥'],['Marca','◇'],['Configuración','⚙']);

  const baseBind=bindPage;
  bindPage=function(){
    baseBind();
    document.querySelectorAll('[data-os-tab]').forEach(b=>b.onclick=()=>{ui[b.dataset.osTab]=b.dataset.tabValue;render();});
    document.querySelectorAll('[data-product-go]').forEach(b=>b.onclick=()=>{const dest=b.dataset.productGo;if(['Métricas','Patrones','Hipótesis','Competencia'].includes(dest)){ui.intelligence=dest;currentPage='Inteligencia';}else if(['Ideas','Replicar','Experimentos'].includes(dest)){ui.strategy=dest;currentPage='Estrategia';}else if(['Personaje','Percepción','Brand Fit'].includes(dest)){ui.brand=dest;currentPage='Marca';}else currentPage=dest;render();});
    document.querySelectorAll('[data-repl]').forEach(b=>b.onclick=()=>{selectedId=+b.dataset.repl;ui.strategy='Replicar';currentPage='Estrategia';render();});
    document.querySelectorAll('[data-go="Ideas"]').forEach(b=>b.onclick=()=>{ui.strategy='Ideas';currentPage='Estrategia';render();});
    document.querySelectorAll('[data-go="Replicar"]').forEach(b=>b.onclick=()=>{ui.strategy='Replicar';currentPage='Estrategia';render();});
  };

  function actionCenter(){
    if(currentPage!=='Resumen')return;
    const page=document.getElementById('page');if(!page||page.querySelector('.cos-action-center'))return;
    const missing=unclassified().length,multi=multiSnapshot().length,r=realReport(),sync=window.ContentOSFreshness?.state?.status;
    const items=[
      {title:`${missing} publicaciones por clasificar`,desc:missing?'Sin clasificación no podemos comparar hooks, temas y promesas con suficiente precisión.':'Todas las publicaciones tienen una clasificación base.',go:'Contenido',state:missing?'warn':'ok'},
      {title:`${multi} piezas con 2+ snapshots`,desc:multi?'La velocidad ya puede empezar a evaluarse en parte de la cuenta.':'Necesitamos la próxima captura para medir aceleración y frenado.',go:'Inteligencia',state:multi?'ok':'wait'},
      {title:`${r.hypotheses?.length||0} hipótesis activas`,desc:r.hypotheses?.length?'Hay señales que ya merecen un experimento.':'Todavía no hay evidencia comparable suficiente para formular reglas.',go:'Inteligencia',state:r.hypotheses?.length?'ok':'wait'},
      {title:sync?.connected?'Sincronización automática activa':'Activar sincronización automática',desc:sync?.connected?`Último dato ${sync.ageMinutes==null?'pendiente':sync.ageMinutes+' min atrás'} · cada hora.`:'Los 44 datos actuales siguen visibles, pero necesitamos autorizar Instagram una vez para mantenerlos al día.',go:'Configuración',state:sync?.connected?'ok':'warn'}
    ];
    const node=document.createElement('div');node.className='cos-action-center';node.innerHTML=`<div class="cos-action-head"><div><div class="module-kicker">QUÉ NECESITA TU ATENCIÓN</div><h3>Estado operativo del Content OS</h3></div><span class="chip">Cuenta real</span></div><div class="cos-action-grid">${items.map(x=>`<button class="cos-action-item ${x.state}" data-product-go="${x.go}"><span class="cos-action-icon"></span><span><strong>${esc2(x.title)}</strong><small>${esc2(x.desc)}</small></span><b>→</b></button>`).join('')}</div>`;
    const header=page.querySelector('.section-header');if(header)header.insertAdjacentElement('afterend',node);else page.prepend(node);
    node.querySelectorAll('[data-product-go]').forEach(b=>b.onclick=()=>{const dest=b.dataset.productGo;if(dest==='Inteligencia'){currentPage='Inteligencia';}else currentPage=dest;render();});
  }

  const baseRender=render;
  render=function(){baseRender();actionCenter();};
  window.ContentOSProductV2={ui,setTab:(g,t)=>{ui[g]=t;render();}};
  render();
})();
