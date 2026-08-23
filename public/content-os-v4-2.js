function renderWorkspaceMenu(){
  const menu=document.getElementById('workspaceMenu'); if(!menu)return;
  const active=activeWorkspace();
  menu.innerHTML=`<div class="workspace-menu-head">Espacio activo</div>
  ${workspaceState.workspaces.map(w=>`<button class="workspace-option ${w.id===workspaceState.activeId?'active':''}" data-workspace="${w.id}"><span class="workspace-avatar">${workspaceInitials(w.name)}</span><span class="workspace-meta"><strong>${w.name}</strong><small>${w.type}</small></span>${w.kind==='personal'?'<span class="workspace-tag">Propio</span>':'<span class="workspace-tag">Cliente</span>'}</button>`).join('')}
  <div class="workspace-divider"></div>
  <button class="workspace-add" id="addClientWorkspace">＋ Agregar cliente / marca</button>
  <div class="workspace-note">Cada cliente vive en un espacio separado. Contenido, métricas, Stories, competencia, personaje, leads y ventas no se mezclan.</div>`;
  document.getElementById('workspaceName').textContent=active.name;
  document.getElementById('workspaceType').textContent=active.type;
  menu.querySelectorAll('[data-workspace]').forEach(b=>b.onclick=()=>{
    workspaceState.activeId=b.dataset.workspace;
    renderWorkspaceMenu(); menu.classList.add('hidden'); document.getElementById('workspaceBtn').setAttribute('aria-expanded','false');
    render(); toast(`Espacio activo: ${activeWorkspace().name}`);
  });
  const add=document.getElementById('addClientWorkspace'); if(add)add.onclick=openClientWorkspaceModal;
}
function bindWorkspaceSwitcher(){
  const btn=document.getElementById('workspaceBtn'),menu=document.getElementById('workspaceMenu'); if(!btn||!menu)return;
  renderWorkspaceMenu();
  btn.onclick=(e)=>{e.stopPropagation();const open=menu.classList.contains('hidden');menu.classList.toggle('hidden',!open);btn.setAttribute('aria-expanded',String(open));};
  document.addEventListener('click',(e)=>{if(!document.getElementById('workspaceSwitch')?.contains(e.target)){menu.classList.add('hidden');btn.setAttribute('aria-expanded','false')}},{capture:true});
}
function openClientWorkspaceModal(){
  document.getElementById('workspaceMenu')?.classList.add('hidden');
  document.getElementById('modalRoot').innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div><h3>Agregar cliente / marca</h3><div class="small-muted">Creamos un espacio aislado para que ninguna métrica ni aprendizaje se mezcle con otra cuenta.</div></div><button class="close" id="closeModal">×</button></div>
  <div class="form-row"><div><span class="label">Nombre del cliente o marca</span><input class="input" id="clientName" style="width:100%" placeholder="Ej: FOCUS Barber"/></div><div><span class="label">Tipo</span><select class="select" id="clientType" style="width:100%"><option>Cliente</option><option>Marca propia</option><option>Proyecto interno</option></select></div></div>
  <div><span class="label">Cuenta principal</span><select class="select" id="clientPlatform" style="width:100%"><option>Instagram Professional</option><option>TikTok</option><option>YouTube</option><option>Agregar después</option></select></div>
  <div class="isolation-note"><strong style="display:block;color:#e8f7ff;margin-bottom:4px">Estructura de datos</strong>GENIDEIA → Cliente → Cuentas conectadas. Cada cliente tendrá su propio contenido, snapshots, Stories, competencia, personaje, leads, seguimientos y ventas. Una cuenta nunca contaminará los patrones de otra.</div>
  <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px"><button class="btn ghost" id="cancelModal">Cancelar</button><button class="btn" id="createClientPreview">Crear espacio</button></div></div></div>`;
  document.getElementById('closeModal').onclick=closeModal;document.getElementById('cancelModal').onclick=closeModal;
  document.getElementById('createClientPreview').onclick=()=>{
    const name=document.getElementById('clientName').value.trim(); if(!name){toast('Escribí el nombre del cliente.');return;}
    const id='client-'+Date.now();
    workspaceState.workspaces.push({id,name,type:document.getElementById('clientType').value,kind:'client',accounts:[]});
    workspaceState.activeId=id; closeModal(); renderWorkspaceMenu(); render(); toast(`Espacio creado: ${name}. Falta conectar su cuenta.`);
  };
}
async function loadSystemHealth(){
  try{
    const res=await fetch('/api/content-os/health',{cache:'no-store'}); if(!res.ok)return;
    const data=await res.json();
    systemHealth.supabase=!!data?.supabase?.ok;
    systemHealth.instagram=!!data?.configured?.instagramToken && !!data?.configured?.instagramUserId;
    systemHealth.instagramApp=!!data?.configured?.instagramApp;
    const own=workspaceState.workspaces.find(w=>w.id===primaryWorkspaceId);
    if(own){own.accounts=[{platform:'Instagram',handle:systemHealth.instagram?'Cuenta conectada':'Pendiente de conectar',status:systemHealth.instagram?'connected':'pending'}];}
    if(currentPage==='Configuración')render();
  }catch(e){}
}
function renderNav(){const el=document.getElementById('nav');el.innerHTML=navItems.map(([name,icon])=>`<button class="nav-item ${name===currentPage?'active':''}" data-page="${name}"><span class="nav-icon">${icon}</span>${name}</button>`).join('');el.querySelectorAll('button').forEach(b=>b.onclick=()=>{currentPage=b.dataset.page;render();});}
function render(){renderNav();const page=document.getElementById('page');page.innerHTML=pages[currentPage]();bindPage();}
function spark(values){const max=Math.max(...values,1),min=Math.min(...values,0),w=120,h=35;const pts=values.map((v,i)=>`${i*(w/(values.length-1))},${h-((v-min)/(max-min||1))*h}`).join(' ');return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%"><polyline points="${pts}" fill="none" stroke="#12aaff" stroke-width="2"/><polyline points="${pts}" fill="none" stroke="#25e5ff" stroke-opacity=".22" stroke-width="6"/></svg>`}
function lineChart(){const series=[42,61,78,120,111,152,139,176,230,310,292,338,365,420,395,360,460,610,672,640,510,462,490,410,382,470,530,512,430,390,415,465];const reach=series.map(v=>v*.72);const inter=series.map(v=>v*.26);const w=760,h=220,p=28,max=750;const pts=s=>s.map((v,i)=>`${p+i*((w-2*p)/(s.length-1))},${h-p-v/max*(h-2*p)}`).join(' ');return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#0aa8ff" stop-opacity=".26"/><stop offset="1" stop-color="#0aa8ff" stop-opacity="0"/></linearGradient></defs>${[0,200,400,600].map(v=>`<line x1="${p}" y1="${h-p-v/max*(h-2*p)}" x2="${w-p}" y2="${h-p-v/max*(h-2*p)}" stroke="#18324b" stroke-width="1"/>`).join('')}<polygon points="${p},${h-p} ${pts(series)} ${w-p},${h-p}" fill="url(#area)"/><polyline points="${pts(series)}" fill="none" stroke="#13a9ff" stroke-width="3"/><polyline points="${pts(reach)}" fill="none" stroke="#0f82e0" stroke-width="2" stroke-dasharray="5 5"/><polyline points="${pts(inter)}" fill="none" stroke="#35d6ff" stroke-width="2" stroke-dasharray="2 6"/></svg>`}
function kpiCard(label,val,delta,icon,vals){return `<div class="card kpi"><div class="kpi-top"><span>${label}</span><span class="kpi-icon">${icon}</span></div><div class="kpi-value">${val}</div><div class="delta">↑ ${delta}% vs. período anterior</div><div class="spark">${spark(vals)}</div></div>`}
function header(title,desc,actions=''){return `<div class="section-header"><div><h2>${title}</h2><p>${desc}</p></div><div class="toolbar">${actions}</div></div>`}
function formatStats(){const map={};published().forEach(v=>{map[v.format]??={views:0,saves:0,shares:0,reach:0,n:0};['views','saves','shares','reach'].forEach(k=>map[v.format][k]+=v[k]);map[v.format].n++});return Object.entries(map).sort((a,b)=>rate(b[1].saves,b[1].reach)-rate(a[1].saves,a[1].reach));}
function topicStats(){const map={};published().forEach(v=>{map[v.topic]??={reach:0,saves:0,shares:0,n:0};['reach','saves','shares'].forEach(k=>map[v.topic][k]+=v[k]);map[v.topic].n++});return Object.entries(map).sort((a,b)=>(b[1].saves+b[1].shares)-(a[1].saves+a[1].shares));}
function topInsight(){const fs=formatStats();const [name,s]=fs[0];const med=published().reduce((a,v)=>a+rate(v.saves,v.reach),0)/published().length;const mult=rate(s.saves,s.reach)/(med||1);return {name,mult};}
