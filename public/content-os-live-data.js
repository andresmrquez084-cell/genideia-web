/* GENIDEIA Content OS — real Supabase data layer */
(function(){
  const state={loaded:false,loading:false,error:null,payload:null};
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const n=(v)=>Number(v||0);
  const div=(a,b)=>n(b)>0?n(a)/n(b):0;
  const rateText=(a,b)=>n(b)>0?`${(n(a)/n(b)*100).toFixed(n(a)/n(b)<.01?2:1)}%`:'—';
  const displayDate=(value)=>{if(!value)return '—';try{return new Intl.DateTimeFormat('es-UY',{day:'2-digit',month:'short'}).format(new Date(value)).replace('.','');}catch{return '—';}};
  const fullDate=(value)=>{if(!value)return '—';try{return new Intl.DateTimeFormat('es-UY',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch{return String(value);}};
  const truncate=(value,max=96)=>{const s=String(value||'').replace(/\s+/g,' ').trim();return s.length>max?s.slice(0,max-1)+'…':s;};
  const inferMediaFormat=(item)=>{
    const classified=item.classification?.format;
    if(classified)return classified;
    const product=String(item.media_product_type||'').toUpperCase();
    const type=String(item.media_type||'').toUpperCase();
    if(product==='REELS')return 'Reel';
    if(type==='CAROUSEL_ALBUM')return 'Carrusel';
    if(type==='IMAGE')return 'Imagen';
    if(type==='VIDEO')return 'Video';
    return 'Por clasificar';
  };
  const makeTitle=(item)=>truncate(item.title||String(item.caption||'').split('\n').find(Boolean)||'Publicación de Instagram',110);

  function mapItem(item,index){
    const m=item.metrics||{};
    const c=item.classification||{};
    const avgWatch=n(m.avg_watch_time_ms)/1000;
    return {
      id:index+1,
      dbId:item.id,
      externalId:item.external_content_id,
      title:makeTitle(item),
      caption:item.caption||'',
      platform:item.platform==='instagram'?'Instagram':item.platform,
      date:displayDate(item.published_at),
      publishedAt:item.published_at,
      format:inferMediaFormat(item),
      topic:c.topic||'Sin clasificar',
      intent:c.intention||'Sin clasificar',
      audience:c.audience||'Sin clasificar',
      hook:c.hook_type||'Sin clasificar',
      hookText:c.hook_text||'',
      duration:n(item.duration_seconds),
      views:n(m.views),
      reach:n(m.reach),
      saves:n(m.saves),
      shares:n(m.shares),
      likes:n(m.likes),
      comments:n(m.comments),
      follows:n(m.follows),
      profileVisits:n(m.profile_visits),
      replies:n(m.replies),
      totalInteractions:n(m.total_interactions)||n(m.likes)+n(m.comments)+n(m.shares)+n(m.saves),
      avgWatch,
      status:'Publicado',
      permalink:item.permalink||'',
      mediaUrl:item.media_url||'',
      thumbnailUrl:item.thumbnail_url||'',
      snapshots:(item.snapshots||[]).map(s=>({
        capturedAt:s.captured_at,
        ageMinutes:s.age_minutes,
        views:n(s.views),reach:n(s.reach),likes:n(s.likes),comments:n(s.comments),shares:n(s.shares),saves:n(s.saves),follows:n(s.follows),profileVisits:n(s.profile_visits),avgWatch:n(s.avg_watch_time_ms)/1000
      })),
      source:'supabase'
    };
  }

  function totals(){
    const pub=published();
    return {
      pieces:pub.length,
      views:pub.reduce((a,v)=>a+n(v.views),0),
      reach:pub.reduce((a,v)=>a+n(v.reach),0),
      interactions:pub.reduce((a,v)=>a+n(v.likes)+n(v.comments)+n(v.saves)+n(v.shares),0),
      saves:pub.reduce((a,v)=>a+n(v.saves),0),
      shares:pub.reduce((a,v)=>a+n(v.shares),0),
      comments:pub.reduce((a,v)=>a+n(v.comments),0),
      follows:pub.reduce((a,v)=>a+n(v.follows),0),
      profileVisits:pub.reduce((a,v)=>a+n(v.profileVisits),0),
    };
  }

  function liveKpi(label,value,sub,icon){return `<div class="card kpi"><div class="kpi-top"><span>${label}</span><span class="kpi-icon">${icon}</span></div><div class="kpi-value">${value}</div><div class="small-muted" style="margin-top:8px">${sub}</div></div>`;}
  function mediaThumb(v){
    const src=v.thumbnailUrl||((v.mediaUrl&&v.format==='Imagen')?v.mediaUrl:'');
    return src?`<div class="thumb" style="overflow:hidden"><img src="${esc(src)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.style.display='none'"/></div>`:`<div class="thumb">${formatIcon[v.format]||'▶'}</div>`;
  }

  function realContentRows(list){
    return list.map(v=>`<tr data-row="${v.id}"><td><div class="content-title">${mediaThumb(v)}<div><strong>${esc(v.title)}</strong><div class="small-muted">Instagram · ${esc(v.date)}${v.duration?` · ${Math.round(v.duration)}s`:''}</div></div></div></td><td><span class="chip">${esc(v.format)}</span><br><span class="chip">${esc(v.topic)}</span></td><td>${fmt(v.views)}</td><td>${fmt(v.reach)}</td><td>${rateText(v.saves,v.views)}</td><td>${rateText(v.shares,v.views)}</td><td>${fmt(v.comments)}</td><td>${rateText(v.follows,v.views)}</td></tr>`).join('');
  }

  function realContentDetail(v){
    if(!v)return '<p class="small-muted">No hay contenido.</p>';
    const snapshotCount=v.snapshots.length;
    const media=v.thumbnailUrl||((v.mediaUrl&&v.format==='Imagen')?v.mediaUrl:'');
    return `<div class="panel-title"><h3>Datos reales</h3><span class="chip green">Supabase</span></div>
      ${media?`<div style="aspect-ratio:16/9;border-radius:12px;overflow:hidden;margin-bottom:14px;background:#07101c"><img src="${esc(media)}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display='none'"/></div>`:''}
      <strong style="display:block;font-size:16px;line-height:1.45">${esc(v.title)}</strong>
      <p class="small-muted">Instagram · ${esc(v.format)} · ${esc(v.topic)} · ${fullDate(v.publishedAt)}</p>
      <div class="metric-grid">
        <div class="metric-box"><span>Views</span><strong>${fmt(v.views)}</strong></div>
        <div class="metric-box"><span>Reach</span><strong>${fmt(v.reach)}</strong></div>
        <div class="metric-box"><span>Guardados</span><strong>${fmt(v.saves)}</strong></div>
        <div class="metric-box"><span>Compartidos</span><strong>${fmt(v.shares)}</strong></div>
        <div class="metric-box"><span>Comentarios</span><strong>${fmt(v.comments)}</strong></div>
        <div class="metric-box"><span>Seguidores</span><strong>${fmt(v.follows)}</strong></div>
      </div>
      <div style="margin-top:14px">
        <div class="variable-row"><span>Save Rate</span><strong>${rateText(v.saves,v.views)}</strong></div>
        <div class="variable-row"><span>Share Rate</span><strong>${rateText(v.shares,v.views)}</strong></div>
        <div class="variable-row"><span>Comment Rate</span><strong>${rateText(v.comments,v.views)}</strong></div>
        <div class="variable-row"><span>Follow Rate</span><strong>${rateText(v.follows,v.views)}</strong></div>
        <div class="variable-row"><span>Profile Visit Rate</span><strong>${rateText(v.profileVisits,v.views)}</strong></div>
        <div class="variable-row"><span>Tiempo medio visto</span><strong>${v.avgWatch?`${v.avgWatch.toFixed(1)}s`:'—'}</strong></div>
        <div class="variable-row"><span>Snapshots</span><strong>${snapshotCount}</strong></div>
      </div>
      <div class="isolation-note" style="margin-top:14px"><strong>Clasificación</strong><br>Hook: ${esc(v.hook)} · Intención: ${esc(v.intent)} · Audiencia: ${esc(v.audience)}. Cuando una variable todavía no fue clasificada, Content OS la mantiene como “Sin clasificar” en lugar de inventarla.</div>
      ${v.permalink?`<a class="btn ghost" href="${esc(v.permalink)}" target="_blank" rel="noopener" style="display:block;text-align:center;margin-top:12px">Abrir publicación en Instagram</a>`:''}`;
  }

  function summaryPage(){
    const t=totals();
    const account=state.payload?.accounts?.[0]||null;
    const followerCount=n(account?.snapshot?.follower_count)||n(account?.raw_profile?.followers_count);
    const latest=[...published()].sort((a,b)=>n(b.views)-n(a.views)).slice(0,5);
    const snapshotCounts=published().map(v=>v.snapshots.length);
    const multi=snapshotCounts.filter(x=>x>=2).length;
    const lastSync=state.payload?.latestSync;
    return `${header('Resumen','Datos reales importados desde tu cuenta de Instagram.',`<span class="chip green">@${esc(account?.username||'instagram')}</span>`)}
      <div class="grid kpi-grid">
        ${liveKpi('Publicaciones',fmt(t.pieces),'piezas reales importadas','▣')}
        ${liveKpi('Views',fmt(t.views),'acumuladas en las publicaciones','◉')}
        ${liveKpi('Reach',fmt(t.reach),'reach acumulado','♙')}
        ${liveKpi('Interacciones',fmt(t.interactions),'likes + comentarios + guardados + compartidos','✦')}
        ${liveKpi('Seguidores generados',fmt(t.follows),followerCount?`${fmt(followerCount)} seguidores actuales`:'según insights disponibles','＋')}
      </div>
      <div class="grid summary-grid" style="margin-top:14px">
        <div class="card panel"><div class="panel-title"><h3>Top publicaciones por views</h3><small>datos reales</small></div>
          <table class="table"><thead><tr><th>#</th><th>Publicación</th><th>Views</th><th>Guardados</th><th>Save Rate</th></tr></thead><tbody>${latest.map((v,i)=>`<tr data-row="${v.id}" style="cursor:pointer"><td>${i+1}</td><td>${esc(v.title)}</td><td>${fmt(v.views)}</td><td>${fmt(v.saves)}</td><td>${rateText(v.saves,v.views)}</td></tr>`).join('')}</tbody></table>
        </div>
        <div class="card panel"><div class="panel-title"><h3>Estado del aprendizaje</h3><small>sin inventar evidencia</small></div>
          <div class="variable-row"><span>Publicaciones con métricas</span><strong>${published().filter(v=>v.views||v.reach||v.likes).length}/${t.pieces}</strong></div>
          <div class="variable-row"><span>Snapshots guardados</span><strong>${state.payload?.counts?.snapshots||0}</strong></div>
          <div class="variable-row"><span>Piezas con 2+ snapshots</span><strong>${multi}</strong></div>
          <div class="variable-row"><span>Velocidad</span><strong>${multi?'Disponible parcialmente':'Esperando próximo snapshot'}</strong></div>
          <div class="variable-row"><span>Última importación</span><strong>${lastSync?.finished_at?fullDate(lastSync.finished_at):'Importación local'}</strong></div>
          <div class="isolation-note" style="margin-top:14px">Las métricas de negocio, leads y ventas no se muestran como reales hasta que exista atribución registrada. Esta pantalla ya no usa los números comerciales demo del prototipo.</div>
        </div>
      </div>
      <div class="grid lower-grid" style="margin-top:14px">
        <div class="card panel"><div class="panel-title"><h3>Tasas de la cuenta</h3><small>denominador: views</small></div>
          <div class="variable-row"><span>Save Rate</span><strong>${rateText(t.saves,t.views)}</strong></div>
          <div class="variable-row"><span>Share Rate</span><strong>${rateText(t.shares,t.views)}</strong></div>
          <div class="variable-row"><span>Comment Rate</span><strong>${rateText(t.comments,t.views)}</strong></div>
          <div class="variable-row"><span>Follow Rate</span><strong>${rateText(t.follows,t.views)}</strong></div>
          <div class="variable-row"><span>Profile Visit Rate</span><strong>${rateText(t.profileVisits,t.views)}</strong></div>
        </div>
        <div class="card panel"><div class="panel-title"><h3>Qué hace Content OS ahora</h3></div><div class="mini-list">
          <div class="mini-row"><div class="ico">1</div><div class="grow"><strong>Observa</strong><small>Lee el rendimiento real de cada publicación.</small></div></div>
          <div class="mini-row"><div class="ico">2</div><div class="grow"><strong>Formula hipótesis</strong><small>Solo cuando existen piezas comparables.</small></div></div>
          <div class="mini-row"><div class="ico">3</div><div class="grow"><strong>Acumula evidencia</strong><small>Los próximos snapshots permitirán medir velocidad y evolución.</small></div></div>
        </div></div>
      </div>`;
  }

  function contentPage(){
    return `${header('Contenido',`${content.length} publicaciones reales de Instagram.`,`<input class="input" id="contentSearch" placeholder="Buscar publicación..."/><select class="select" id="formatFilter"><option value="">Todos los formatos</option>${[...new Set(content.map(x=>x.format))].map(x=>`<option>${esc(x)}</option>`).join('')}</select>`)}
      <div class="content-layout"><div class="card content-table-card"><table class="content-table"><thead><tr><th>Contenido</th><th>Formato / tema</th><th>Views</th><th>Reach</th><th>Save Rate</th><th>Share Rate</th><th>Comentarios</th><th>Follow Rate</th></tr></thead><tbody id="contentRows">${realContentRows(content)}</tbody></table></div><div class="card side-detail" id="contentDetail">${realContentDetail(content.find(x=>x.id===selectedId)||content[0])}</div></div>`;
  }

  function metricsPage(){
    const t=totals();
    const rows=[...published()].sort((a,b)=>n(b.views)-n(a.views)).slice(0,12);
    const withMulti=published().filter(v=>v.snapshots.length>=2);
    return `${header('Métricas','Performance real de la cuenta. Las tasas se normalizan por views.')}
      <div class="grid metric-wide-grid">
        <div class="card panel"><div class="panel-title"><h3>Métricas acumuladas</h3><small>${t.pieces} publicaciones</small></div>
          ${[['Views',fmt(t.views)],['Reach',fmt(t.reach)],['Interacciones',fmt(t.interactions)],['Guardados',fmt(t.saves)],['Compartidos',fmt(t.shares)],['Comentarios',fmt(t.comments)],['Seguidores generados',fmt(t.follows)]].map(([a,b])=>`<div class="variable-row"><span>${a}</span><strong>${b}</strong></div>`).join('')}
        </div>
        <div class="card panel"><div class="panel-title"><h3>Tasas prioritarias</h3><small>denominador: views</small></div>
          ${[['Save Rate',rateText(t.saves,t.views)],['Share Rate',rateText(t.shares,t.views)],['Comment Rate',rateText(t.comments,t.views)],['Follow Rate',rateText(t.follows,t.views)],['Profile Visit Rate',rateText(t.profileVisits,t.views)]].map(([a,b])=>`<div class="variable-row"><span>${a}</span><strong>${b}</strong></div>`).join('')}
        </div>
      </div>
      <div class="card panel" style="margin-top:14px"><div class="panel-title"><h3>Velocidad del contenido</h3><small>1h · 3h · 6h · 12h · 24h · 48h · 7d</small></div>
        <div class="module-banner" style="margin:0"><div class="module-kicker">SNAPSHOTS REALES</div><h3>${withMulti.length?`${withMulti.length} piezas ya tienen más de una captura.`:'Todavía hay una sola captura por publicación.'}</h3><p>${withMulti.length?'El sistema puede empezar a comparar evolución en esas piezas.':'Necesitamos el próximo snapshot para distinguir contenido acelerando, estable o frenándose. No se infiere velocidad con una única captura.'}</p></div>
      </div>
      <div class="card panel" style="margin-top:14px"><div class="panel-title"><h3>Publicaciones</h3><small>ordenadas por views</small></div><table class="table"><thead><tr><th>Publicación</th><th>Views</th><th>Reach</th><th>Save Rate</th><th>Share Rate</th><th>Comment Rate</th><th>Follow Rate</th><th>Snapshots</th></tr></thead><tbody>${rows.map(v=>`<tr><td>${esc(v.title)}</td><td>${fmt(v.views)}</td><td>${fmt(v.reach)}</td><td>${rateText(v.saves,v.views)}</td><td>${rateText(v.shares,v.views)}</td><td>${rateText(v.comments,v.views)}</td><td>${rateText(v.follows,v.views)}</td><td>${v.snapshots.length}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function installRealPages(){
    contentRows=realContentRows;
    contentDetail=realContentDetail;
    pages['Resumen']=summaryPage;
    pages['Contenido']=contentPage;
    pages['Métricas']=metricsPage;
  }

  function applyPayload(payload){
    state.payload=payload;
    const mapped=(payload.content||[]).map(mapItem);
    content.splice(0,content.length,...mapped);
    selectedId=content[0]?.id||null;
    const account=payload.accounts?.[0];
    const own=workspaceState.workspaces.find(w=>w.id===primaryWorkspaceId);
    if(own&&account){
      own.accounts=[{platform:'Instagram',handle:`@${account.username||'instagram'}`,status:'connected'}];
      own.type=account.account_type?`Instagram · ${account.account_type}`:'Marca personal';
    }
    systemHealth.supabase=true;
    systemHealth.instagram=Boolean(account);
    installRealPages();
    state.loaded=true;
    state.error=null;
    renderWorkspaceMenu();
    render();
    const btn=document.getElementById('syncBtn');
    if(btn){btn.textContent='↻ Actualizar';btn.onclick=()=>loadLiveData(true);}
  }

  async function loadLiveData(showToast=false){
    if(state.loading)return;
    state.loading=true;
    const btn=document.getElementById('syncBtn');
    if(btn)btn.textContent='↻ Cargando...';
    try{
      const response=await fetch('/api/content-os/live-data',{cache:'no-store'});
      const payload=await response.json();
      if(!response.ok||!payload.ok)throw new Error(payload.error||`HTTP ${response.status}`);
      applyPayload(payload);
      if(showToast)toast(`${payload.counts?.content||content.length} publicaciones actualizadas desde Supabase.`);
    }catch(error){
      state.error=error.message;
      console.error('Content OS live data',error);
      if(showToast)toast(`No se pudieron actualizar los datos: ${error.message}`);
    }finally{
      state.loading=false;
      const b=document.getElementById('syncBtn');if(b)b.textContent='↻ Actualizar';
    }
  }

  window.ContentOSLiveData={state,load:loadLiveData};
  loadLiveData(false);
})();
