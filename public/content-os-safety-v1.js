/* GENIDEIA Content OS — masterclass safety gate */
(function(){
  const reveal=()=>{
    document.body.style.visibility='visible';
    document.documentElement.classList.add('content-os-ready');
  };
  const ensureOverlay=()=>{
    let overlay=document.getElementById('contentOsDataError');
    if(overlay) return overlay;
    overlay=document.createElement('div');
    overlay.id='contentOsDataError';
    overlay.style.cssText='position:fixed;inset:0 0 0 260px;z-index:9999;background:#020714;display:flex;align-items:center;justify-content:center;padding:32px';
    overlay.innerHTML=`<div style="max-width:620px;width:100%;padding:28px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:#07101c;box-shadow:0 24px 80px rgba(0,0,0,.35)"><div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.6;margin-bottom:10px">Content OS · datos reales</div><h2 style="margin:0 0 10px;font-size:28px">No pudimos cargar los datos de la cuenta.</h2><p style="margin:0 0 18px;line-height:1.6;opacity:.78">Para evitar mostrar información de ejemplo como si fuera real, Content OS detuvo la vista. Podés reintentar la conexión.</p><button id="contentOsRetry" class="btn">↻ Reintentar</button><div id="contentOsErrorDetail" style="margin-top:14px;font-size:12px;opacity:.45;word-break:break-word"></div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#contentOsRetry').onclick=async()=>{
      const btn=overlay.querySelector('#contentOsRetry');
      btn.disabled=true;btn.textContent='↻ Reintentando...';
      try{ await window.ContentOSLiveData?.load?.(false); }finally{ btn.disabled=false;btn.textContent='↻ Reintentar'; }
    };
    return overlay;
  };
  const clearDemoData=()=>{
    try{ if(typeof content!=='undefined'&&Array.isArray(content)) content.splice(0,content.length); }catch(_e){}
  };
  const tick=()=>{
    const api=window.ContentOSLiveData;
    if(!api?.state) return;
    if(api.state.loaded){
      document.getElementById('contentOsDataError')?.remove();
      reveal();
      return true;
    }
    if(api.state.error){
      clearDemoData();
      const overlay=ensureOverlay();
      const detail=overlay.querySelector('#contentOsErrorDetail');
      if(detail) detail.textContent=api.state.error;
      reveal();
      return false;
    }
  };
  const timer=setInterval(()=>{ if(tick()===true) clearInterval(timer); },80);
  setTimeout(()=>{
    const api=window.ContentOSLiveData;
    if(!api?.state?.loaded&&!api?.state?.error){
      clearDemoData();
      const overlay=ensureOverlay();
      const detail=overlay.querySelector('#contentOsErrorDetail');
      if(detail) detail.textContent='La carga está tardando más de lo esperado.';
      reveal();
    }
  },8000);
})();
