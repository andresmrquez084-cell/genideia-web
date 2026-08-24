const STORY_FILTER_CRITERIA=[
  'La idea de la Story está realmente dirigida al avatar.',
  'En el copy no sobra ni una palabra; no hay una forma más corta de decir lo mismo.',
  'El hook llama la atención; antes se escribieron aproximadamente 5–10 alternativas y este es el mejor.',
  'El diseño acompaña la marca personal, se ve limpio y no huele a venta.',
  'La secuencia abre un loop que no se cierra hasta el final.',
  'Comunica algo que vale la pena que el avatar escuche; no es relleno.'
];

const STORY_FILTER_PASSES=[
  ['guion','Filtro 1 · Guion'],
  ['revision','Filtro 2 · Revisión'],
  ['publicacion','Filtro 3 · Publicación']
];

const STORY_SYSTEM_STEPS=[
  ['1','Definir percepción','Qué marca querés construir y cómo querés ser percibido.'],
  ['2','Nutrir','Mentor, Mecanismo, Ellos mismos y Hype.'],
  ['3','Elegir objetivo','Nutrición, conversación, lead magnet, venta, volumen o calidad.'],
  ['4','Escribir secuencia','Usar una estructura o combinación adaptada al caso.'],
  ['5','Pasar el filtro','Hook, copy, diseño, valor, loop y ajuste al avatar.'],
  ['6','Publicar','Mantener espontaneidad sin improvisar las acciones comerciales.'],
  ['7','Medir','Views, retención, respuestas, RTA, calidad y urgencia de leads.'],
  ['8','Documentar','Guardar la secuencia y el enlace en una biblioteca.'],
  ['9','Aplicar 80/20','Duplicar patrones ganadores y eliminar lo que no funciona.']
];

const STORY_NUTRITION=[
  ['Mentor','Refuerza tu forma de pensar, criterio, aprendizajes o visión. La audiencia recibe una idea que puede usar y te asocia con guía o criterio.'],
  ['Mecanismo','Explica por qué tu forma de conseguir el resultado funciona y por qué puede ser mejor para el avatar que otras alternativas.'],
  ['Ellos mismos','Pone al avatar en el centro: sus situaciones, resultados, conversaciones, objeciones, comportamientos o experiencias.'],
  ['Hype','Genera anticipación, expectativa o curiosidad alrededor de algo que está ocurriendo o que se va a revelar.']
];

const STORY_MECHANISM_ATTRIBUTES=['Rentabilidad','Facilidad','Simpleza','Margen de ganancia','Velocidad para conseguir resultados','Datos que respaldan el método','Novedad','Aprovechar una tendencia','Ser poco conocido','Escalabilidad','Fundamento científico','Fundamento técnico'];

const STORY_ANGLES=[
  ['Contradicción','“Todos hacen X creyendo que es lo mejor, pero eso produce Y; la alternativa es Z.”'],
  ['Analogía histórica','Comparar una oportunidad actual con un momento histórico para hacerla más fácil de entender.'],
  ['Contra-señal del nicho','Si todos muestran una imagen perfecta, mostrar una realidad tangible o un resultado sin decorado.'],
  ['Transparencia','Mostrar también pérdidas, errores o resultados no ideales para aumentar credibilidad.'],
  ['Prueba del mecanismo','“Funciona porque es simple, porque tiene datos detrás y porque ya produjo X resultado.”']
];

const STORY_STRUCTURES=[
  ['Estructura 1 — Estadística negativa','1. Estadística negativa · 2. Contexto / mecanismo · 3. CTA'],
  ['Estructura 2 — Contraste “Mientras todos…”','1. Mientras todos… · 2. Tomi generó X sin Y a través de Z · 3. CTA'],
  ['Estructura 3 — Historia de transformación','1. Cliente · 2. Desire (deseo) · 3. Wall (obstáculo) · 4. Epiphany (descubrimiento) · 5. Transformación + CTA'],
  ['Estructura 7 — Venta rápida','1. “Hoy vendo rápido” · 2. Por qué · 3. CTA']
];

const storySystemState={tab:'Crear',filters:{},competitors:[]};

function storySeq(){
  return storySequences.find(x=>x.id===selectedStory)||storySequences[0];
}

function storyFilterState(seqId,passId){
  storySystemState.filters[seqId]??={};
  storySystemState.filters[seqId][passId]??=Array(STORY_FILTER_CRITERIA.length).fill(false);
  return storySystemState.filters[seqId][passId];
}

function storySelect(label,key,values,seq){
  const current=seq[key]||'';
  return `<div><span class="label">${label}</span><select class="select story-field" data-story-field="${key}" style="width:100%"><option value="">Seleccionar</option>${values.map(v=>`<option ${current===v?'selected':''}>${v}</option>`).join('')}</select></div>`;
}

function storyMulti(label,key,values,seq){
  const selected=Array.isArray(seq[key])?seq[key]:[];
  return `<div><span class="label">${label}</span><div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:7px">${values.map(v=>`<button type="button" class="chip story-multi ${selected.includes(v)?'green':''}" data-story-multi="${key}" data-value="${v}">${v}</button>`).join('')}</div></div>`;
}

function storyTabs(){
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">${['Sistema','Crear','El Filtro','Biblioteca','Métricas','Competencia'].map(t=>`<button class="btn ${storySystemState.tab===t?'':'ghost'} story-tab" data-story-tab="${t}">${t}</button>`).join('')}</div>`;
}

function storySystemOverview(){
  return `<div class="grid pattern-grid">${STORY_SYSTEM_STEPS.map(([n,a,b])=>`<div class="card panel"><div class="module-kicker">PASO ${n}</div><h3 style="margin:7px 0">${a}</h3><p class="small-muted">${b}</p></div>`).join('')}</div>`;
}

function storyBuilder(seq){
  return `<div class="grid" style="grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);gap:14px">
    <div class="card panel">
      <div class="panel-title"><div><h3>${seq.name}</h3><small>Escribir secuencia</small></div><span class="chip">${seq.status}</span></div>
      <div class="form-row">
        ${storySelect('Definir percepción','perception',['Lifestyle','Story Brand','Experto en la materia'],seq)}
        ${storySelect('Tipo','nutritionType',['Mentor','Mecanismo','Ellos mismos','Hype','CTA'],seq)}
      </div>
      <div class="form-row">
        ${storySelect('Objetivo','storyObjective',['Nutrición','Conversación','Lead Magnet','Venta'],seq)}
        ${storySelect('CTA','ctaOptimization',['Cantidad de respuestas','Calidad de respuestas'],seq)}
      </div>
      ${storyMulti('Vender el mecanismo','mechanismAttributes',STORY_MECHANISM_ATTRIBUTES,seq)}
      <div style="height:12px"></div>
      ${storySelect('Ángulo','marketingAngle',STORY_ANGLES.map(x=>x[0]),seq)}
      <div style="height:12px"></div>
      ${storySelect('Estructura','storyStructure',STORY_STRUCTURES.map(x=>x[0]),seq)}
      <div style="height:14px"></div>
      <span class="label">Hook</span>
      <textarea class="input story-text" data-story-text="hook" style="width:100%;min-height:70px">${seq.hook||''}</textarea>
      <div style="height:12px"></div>
      <div class="panel-title"><h3>Stories</h3><button class="btn ghost" id="addStoryFrame">+ Story</button></div>
      <div>${seq.frames.map((f,i)=>`<div class="card" style="padding:12px;margin-bottom:8px"><div class="form-row"><div><span class="label">Story ${i+1}</span><input class="input story-frame-role" data-frame="${i}" value="${String(f.role||'').replace(/"/g,'&quot;')}" style="width:100%"/></div><div><span class="label">CTA</span><input class="input story-frame-cta" data-frame="${i}" value="${String(f.cta||'').replace(/"/g,'&quot;')}" style="width:100%"/></div></div><span class="label">Copy</span><textarea class="input story-frame-copy" data-frame="${i}" style="width:100%;min-height:82px">${f.copy||''}</textarea></div>`).join('')}</div>
    </div>
    <div>
      <div class="card panel"><div class="panel-title"><h3>Nutrición</h3><small>Los cuatro tipos</small></div>${STORY_NUTRITION.map(([a,b])=>`<div class="variable-row" style="display:block"><strong>${a}</strong><div class="small-muted" style="margin-top:4px">${b}</div></div>`).join('')}</div>
      <div class="card panel" style="margin-top:14px"><div class="panel-title"><h3>Ángulos de marketing</h3></div>${STORY_ANGLES.map(([a,b])=>`<div class="variable-row" style="display:block"><strong>${a}</strong><div class="small-muted" style="margin-top:4px">${b}</div></div>`).join('')}</div>
      <div class="card panel" style="margin-top:14px"><div class="panel-title"><h3>Estructuras</h3></div>${STORY_STRUCTURES.map(([a,b])=>`<div class="variable-row" style="display:block"><strong>${a}</strong><div class="small-muted" style="margin-top:4px">${b}</div></div>`).join('')}</div>
    </div>
  </div>`;
}

function storyFilterView(seq){
  return `<div class="module-banner"><div class="module-kicker">EL FILTRO</div><h3>Checklist de control de calidad.</h3></div>
  <div class="grid pattern-grid" style="margin-top:14px">${STORY_FILTER_PASSES.map(([id,label])=>{const state=storyFilterState(seq.id,id);const done=state.filter(Boolean).length;return `<div class="card panel"><div class="panel-title"><h3>${label}</h3><span class="chip ${done===6?'green':done?'amber':''}">${done}/6</span></div>${STORY_FILTER_CRITERIA.map((c,i)=>`<label style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer"><input type="checkbox" class="story-filter-check" data-pass="${id}" data-index="${i}" ${state[i]?'checked':''}/><span>${c}</span></label>`).join('')}</div>`}).join('')}</div>`;
}

function storyLibraryView(){
  return `<div class="card panel"><div class="panel-title"><h3>Biblioteca de secuencias</h3><small>${storySequences.length} secuencias</small></div><table class="table"><thead><tr><th>Secuencia</th><th>Objetivo</th><th>Tipo</th><th>Estructura</th><th>Ángulo</th><th>Stories</th></tr></thead><tbody>${storySequences.map(s=>`<tr data-story="${s.id}" style="cursor:pointer"><td>${s.name}</td><td>${s.storyObjective||s.intent||'—'}</td><td>${s.nutritionType||'—'}</td><td>${s.storyStructure||'—'}</td><td>${s.marketingAngle||'—'}</td><td>${s.frames.length}</td></tr>`).join('')}</tbody></table></div>`;
}

function storyMetricsView(){
  const fields=[
    ['Fecha','Cuándo se publicó'],['Objetivo','Nutrición / conversación / LM / venta'],['Tipo','Mentor / Mecanismo / Ellos mismos / Hype / CTA'],['Estructura','1, 2, 3, 7 u otra combinación'],['Hook','Primera frase o primera Story'],['Ángulo','Velocidad / facilidad / rentabilidad / prueba / novedad / etc.'],['Stories','Cantidad de piezas en la secuencia'],['Views iniciales','Views de la primera Story'],['Views finales','Views de la última Story'],['Retención','Views finales ÷ views iniciales'],['Respuestas','Cantidad total'],['RTA','Respuestas ÷ views relevantes'],['Calidad de lead','Baja / media / alta o criterio propio'],['Resultado','Lead magnet entregado / conversación / venta / otro'],['URL / evidencia','Enlace o captura de la secuencia'],['Aprendizaje','Qué duplicar y qué evitar']
  ];
  return `<div class="grid metric-wide-grid"><div class="card panel"><div class="panel-title"><h3>Ficha recomendada para registrar cada secuencia</h3></div>${fields.map(([a,b])=>`<div class="variable-row"><span>${a}</span><strong style="text-align:right">${b}</strong></div>`).join('')}</div><div class="card panel"><div class="panel-title"><h3>Fórmulas mínimas</h3></div><div class="outcome-box"><div class="outcome-title">Retención de secuencia</div><strong>Views de la última Story ÷ views de la primera Story × 100.</strong></div><div class="outcome-box" style="margin-top:12px"><div class="outcome-title">Tasa de respuesta (RTA)</div><strong>Respuestas ÷ views de la Story o secuencia tomada como base × 100.</strong></div><div class="isolation-note" style="margin-top:14px">Las métricas reales de Stories se mostrarán aquí cuando la sincronización de Stories esté conectada.</div></div></div>`;
}

function storyCompetitionView(){
  return `<div class="module-banner"><div class="module-kicker">COMPETENCIA · STORIES</div><h3>Comparativa estructural.</h3><p>Se registran referencias usando los mismos factores del sistema. Las métricas privadas de otras cuentas no se inventan.</p></div>
  <div class="card panel" style="margin-top:14px"><div class="panel-title"><h3>Agregar referencia</h3><small>competidores y referentes</small></div><div class="form-row"><div><span class="label">Cuenta</span><input class="input" id="storyCompCreator" style="width:100%" placeholder="@cuenta"/></div><div><span class="label">URL / evidencia</span><input class="input" id="storyCompUrl" style="width:100%"/></div></div><div class="form-row"><div><span class="label">Tipo</span><select class="select" id="storyCompType" style="width:100%"><option>Mentor</option><option>Mecanismo</option><option>Ellos mismos</option><option>Hype</option><option>CTA</option></select></div><div><span class="label">Ángulo</span><select class="select" id="storyCompAngle" style="width:100%">${STORY_ANGLES.map(x=>`<option>${x[0]}</option>`).join('')}</select></div></div><div class="form-row"><div><span class="label">Estructura</span><select class="select" id="storyCompStructure" style="width:100%">${STORY_STRUCTURES.map(x=>`<option>${x[0]}</option>`).join('')}</select></div><div><span class="label">Hook</span><input class="input" id="storyCompHook" style="width:100%"/></div></div><button class="btn" id="saveStoryCompetitor">Guardar referencia</button></div>
  <div class="card panel" style="margin-top:14px"><div class="panel-title"><h3>Referencias guardadas</h3><small>${storySystemState.competitors.length}</small></div>${storySystemState.competitors.length?`<table class="table"><thead><tr><th>Cuenta</th><th>Tipo</th><th>Ángulo</th><th>Estructura</th><th>Hook</th></tr></thead><tbody>${storySystemState.competitors.map(c=>`<tr><td>${c.creator}</td><td>${c.type}</td><td>${c.angle}</td><td>${c.structure}</td><td>${c.hook||'—'}</td></tr>`).join('')}</tbody></table>`:'<p class="small-muted">Todavía no hay referencias de Stories guardadas.</p>'}</div>`;
}

pages['Stories']=()=>{
  const seq=storySeq();
  const body=storySystemState.tab==='Sistema'?storySystemOverview():storySystemState.tab==='Crear'?storyBuilder(seq):storySystemState.tab==='El Filtro'?storyFilterView(seq):storySystemState.tab==='Biblioteca'?storyLibraryView():storySystemState.tab==='Métricas'?storyMetricsView():storyCompetitionView();
  return `${header('Stories','Sistema operativo de Stories de Instagram.',`<button class="btn" id="newStorySequence">+ Nueva secuencia</button>`)}
  <div class="module-banner"><div class="module-kicker">SISTEMA OPERATIVO</div><h3>Alcance trae visitas → nutrición crea percepción → CTA convierte → métricas validan → biblioteca documenta → 80/20 mejora la siguiente ronda.</h3></div>
  ${storyTabs()}${body}`;
};

function openStorySystemModal(){
  document.getElementById('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>Nueva secuencia de Stories</h3><button class="close" id="closeModal">×</button></div><div><span class="label">Nombre</span><input class="input" id="ssName" style="width:100%"/></div><div class="form-row"><div><span class="label">Objetivo</span><select class="select" id="ssObjective" style="width:100%"><option>Nutrición</option><option>Conversación</option><option>Lead Magnet</option><option>Venta</option></select></div><div><span class="label">Tipo</span><select class="select" id="ssType" style="width:100%"><option>Mentor</option><option>Mecanismo</option><option>Ellos mismos</option><option>Hype</option><option>CTA</option></select></div></div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button class="btn ghost" id="cancelModal">Cancelar</button><button class="btn" id="createStorySystemSeq">Crear secuencia</button></div></div></div>`;
  document.getElementById('closeModal').onclick=closeModal;
  document.getElementById('cancelModal').onclick=closeModal;
  document.getElementById('createStorySystemSeq').onclick=()=>{
    const name=document.getElementById('ssName').value.trim();
    if(!name)return toast('Poné un nombre a la secuencia.');
    const id=Date.now();
    const objective=document.getElementById('ssObjective').value;
    storySequences.unshift({id,name,intent:objective,storyObjective:objective,nutritionType:document.getElementById('ssType').value,status:'Borrador',frames:[{role:'Story 1',copy:'',cta:''}]});
    selectedStory=id;storySystemState.tab='Crear';closeModal();render();
  };
}

function bindStorySystem(){
  document.querySelectorAll('.story-tab').forEach(b=>b.onclick=()=>{storySystemState.tab=b.dataset.storyTab;render();});
  document.querySelectorAll('.story-field').forEach(el=>el.onchange=()=>{storySeq()[el.dataset.storyField]=el.value;});
  document.querySelectorAll('.story-text').forEach(el=>el.oninput=()=>{storySeq()[el.dataset.storyText]=el.value;});
  document.querySelectorAll('.story-multi').forEach(b=>b.onclick=()=>{const seq=storySeq(),key=b.dataset.storyMulti,val=b.dataset.value;seq[key]??=[];seq[key]=seq[key].includes(val)?seq[key].filter(x=>x!==val):[...seq[key],val];render();});
  document.querySelectorAll('.story-frame-role').forEach(el=>el.oninput=()=>storySeq().frames[+el.dataset.frame].role=el.value);
  document.querySelectorAll('.story-frame-copy').forEach(el=>el.oninput=()=>storySeq().frames[+el.dataset.frame].copy=el.value);
  document.querySelectorAll('.story-frame-cta').forEach(el=>el.oninput=()=>storySeq().frames[+el.dataset.frame].cta=el.value);
  document.querySelectorAll('.story-filter-check').forEach(el=>el.onchange=()=>{storyFilterState(storySeq().id,el.dataset.pass)[+el.dataset.index]=el.checked;render();});
  const add=document.getElementById('addStoryFrame');if(add)add.onclick=()=>{storySeq().frames.push({role:`Story ${storySeq().frames.length+1}`,copy:'',cta:''});render();};
  const ns=document.getElementById('newStorySequence');if(ns)ns.onclick=openStorySystemModal;
  const saveComp=document.getElementById('saveStoryCompetitor');if(saveComp)saveComp.onclick=()=>{const creator=document.getElementById('storyCompCreator').value.trim();if(!creator)return toast('Agregá la cuenta.');storySystemState.competitors.unshift({creator,url:document.getElementById('storyCompUrl').value.trim(),type:document.getElementById('storyCompType').value,angle:document.getElementById('storyCompAngle').value,structure:document.getElementById('storyCompStructure').value,hook:document.getElementById('storyCompHook').value.trim()});render();};
}

const _contentOSBindPage=bindPage;
bindPage=function(){
  _contentOSBindPage();
  if(currentPage==='Stories')bindStorySystem();
};
