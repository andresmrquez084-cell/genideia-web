/* GENIDEIA Content OS — masterclass-ready truth layer */
(function(){
  const esc=(v)=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fullDate=(value)=>{if(!value)return '—';try{return new Intl.DateTimeFormat('es-UY',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch{return String(value);}};

  function install(){
    const live=window.ContentOSLiveData?.state;
    if(!live?.loaded||typeof pages==='undefined') return false;
    const payload=live.payload||{};
    const account=payload.accounts?.[0]||null;
    const lastSync=payload.latestSync||null;
    const counts=payload.counts||{};
    const syncOk=lastSync?.status==='completed'||lastSync?.status==='completed_with_errors';

    pages['Configuración']=()=>`${header('Configuración','Estado real de las fuentes y automatizaciones del Content OS.')}
      <div class="grid settings-grid">
        <div class="card connection-card">
          <div class="panel-title"><h3>Fuentes conectadas</h3><small>datos verificados</small></div>
          <div class="connection-row"><div class="connection-name"><div class="platform-icon">DB</div><div><strong>Supabase</strong><div class="small-muted">${counts.content||0} publicaciones · ${counts.snapshots||0} snapshots históricos</div></div></div><span class="source-status ok">Conectado</span></div>
          <div class="connection-row"><div class="connection-name"><div class="platform-icon">◎</div><div><strong>Instagram</strong><div class="small-muted">${account?.username?'@'+esc(account.username):'Cuenta importada'} · última captura ${lastSync?.finished_at?fullDate(lastSync.finished_at):'sin fecha'}</div></div></div><span class="source-status ${syncOk?'ok':'wait'}">${syncOk?'Datos disponibles':'Revisar sync'}</span></div>
          <div class="connection-row"><div class="connection-name"><div class="platform-icon">♪</div><div><strong>TikTok</strong><div class="small-muted">Integración de métricas cruzadas</div></div></div><span class="source-status">Próximamente</span></div>
          <div class="connection-row"><div class="connection-name"><div class="platform-icon">▶</div><div><strong>YouTube Shorts</strong><div class="small-muted">Integración de rendimiento por pieza</div></div></div><span class="source-status">Próximamente</span></div>
        </div>
        <div class="card connection-card">
          <div class="panel-title"><h3>Motor de aprendizaje</h3><small>qué está funcionando hoy</small></div>
          <div class="variable-row"><span>Lectura de métricas reales</span><strong>Activa</strong></div>
          <div class="variable-row"><span>Snapshots históricos</span><strong>${counts.snapshots||0}</strong></div>
          <div class="variable-row"><span>Clasificación de contenido</span><strong>${counts.classifications||0}/${counts.content||0} provisional</strong></div>
          <div class="variable-row"><span>Detección de patrones</span><strong>Activa</strong></div>
          <div class="variable-row"><span>Hipótesis automáticas</span><strong>Activa · no causal</strong></div>
          <div class="variable-row"><span>Atribución a leads / ventas</span><strong>Próximamente</strong></div>
          <div class="isolation-note" style="margin-top:14px"><strong>Importante</strong><br>La clasificación actual es automática y provisional. El sistema distingue observaciones, hipótesis y reglas confirmadas para no presentar correlaciones como causalidad.</div>
        </div>
      </div>
      <div class="card panel" style="margin-top:14px"><div class="panel-title"><h3>Taxonomía activa</h3><small>variables utilizadas para comparar publicaciones</small></div><div>${['Formato','Tema','Hook','Intención','Audiencia','Cantidad de elementos','Promesa','Nivel de conocimiento','Plataforma','Snapshots'].map(x=>`<span class="chip">${x}</span>`).join('')}</div></div>`;

    const btn=document.getElementById('syncBtn');
    if(btn){
      btn.textContent='↻ Recargar datos';
      btn.title='Vuelve a leer los datos disponibles en Content OS. No fuerza una nueva sincronización de Instagram.';
    }
    try{render();}catch(_e){}
    return true;
  }

  const timer=setInterval(()=>{if(install())clearInterval(timer);},150);
  setTimeout(()=>clearInterval(timer),12000);
})();
