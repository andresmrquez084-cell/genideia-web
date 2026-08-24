/* Content OS live freshness + foreground refresh */
(function(){
  const state={status:null,timer:null};
  const fmtAge=(m)=>m===null||m===undefined?'sin sincronización':m<1?'ahora':m<60?`hace ${m} min`:m<1440?`hace ${Math.floor(m/60)} h`:`hace ${Math.floor(m/1440)} d`;
  const labels={fresh:['Datos al día','ok'],delayed:['Sincronización retrasada','warn'],stale:['Datos desactualizados','bad'],waiting_first_sync:['Esperando primera sincronización','warn'],not_connected:['Sincronización automática desactivada','off']};
  function ensure(){let el=document.getElementById('cosFreshness');if(el)return el;el=document.createElement('div');el.id='cosFreshness';el.className='cos-freshness';const top=document.querySelector('.topbar');if(top)top.insertAdjacentElement('afterend',el);return el}
  function render(s){const el=ensure();const [label,cls]=labels[s?.freshness]||['Estado de sincronización','warn'];const account=s?.account?`@${s.account}`:'Instagram';const meta=s?.connected?`${fmtAge(s.ageMinutes)} · automática cada hora`:'Los datos actuales siguen visibles, pero no se actualizarán solos hasta autorizar Instagram.';el.className=`cos-freshness ${cls}`;el.innerHTML=`<div class="cos-freshness-main"><span class="cos-dot"></span><div><strong>${label}</strong><small>${account} · ${meta}</small></div></div>${s?.connected?'<span class="cos-auto">AUTO</span>':`<a class="cos-connect" href="${s?.connectUrl||'/api/content-os/connect-instagram-direct'}">Activar sincronización automática</a>`}`;}
  async function status(){try{const r=await fetch('/api/content-os/sync-status',{cache:'no-store'});const p=await r.json();if(!r.ok||!p.ok)throw new Error(p.error||`HTTP ${r.status}`);state.status=p;render(p);}catch(e){render({freshness:'delayed',connected:false,connectUrl:'/api/content-os/connect-instagram-direct'});console.error('sync status',e)}}
  async function refresh(){await status();if(window.ContentOSLiveData?.load)await window.ContentOSLiveData.load(false)}
  function boot(){status();state.timer=setInterval(refresh,5*60*1000);const q=new URLSearchParams(location.search);if(q.get('instagram')==='connected'){setTimeout(refresh,800);q.delete('instagram');history.replaceState({},'',location.pathname+(q.toString()?`?${q}`:'')+location.hash)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  window.ContentOSFreshness={state,refresh,status};
})();
