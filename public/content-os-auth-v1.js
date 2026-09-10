/* GENIDEIA Content OS — login gate */
(function(){
  const originalFetch=window.fetch.bind(window);
  let resolveAuth;
  let authenticated=false;
  let checking=true;
  const authReady=new Promise(resolve=>{resolveAuth=resolve;});
  window.ContentOSAuth={waiting:true,authenticated:false};

  function showLogin(message=''){
    checking=false;
    window.ContentOSAuth.waiting=true;
    document.body.style.visibility='visible';
    let overlay=document.getElementById('contentOsLogin');
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id='contentOsLogin';
      overlay.style.cssText='position:fixed;inset:0;z-index:10000;background:#020714;display:flex;align-items:center;justify-content:center;padding:28px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#fff';
      overlay.innerHTML=`<form id="contentOsLoginForm" style="width:min(430px,100%);padding:34px;border:1px solid rgba(255,255,255,.12);border-radius:24px;background:linear-gradient(180deg,#081222,#050b15);box-shadow:0 30px 100px rgba(0,0,0,.45)">
        <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.55;margin-bottom:12px">GENIDEIA COMPANY</div>
        <h1 style="font-size:30px;line-height:1.1;margin:0 0 8px">Content OS</h1>
        <p style="margin:0 0 26px;color:rgba(255,255,255,.62);line-height:1.55">Acceso privado a la demostración en vivo.</p>
        <label style="display:block;font-size:12px;opacity:.7;margin-bottom:7px">Usuario</label>
        <input id="contentOsUser" autocomplete="username" required style="width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#030914;color:white;outline:none;margin-bottom:15px"/>
        <label style="display:block;font-size:12px;opacity:.7;margin-bottom:7px">Contraseña</label>
        <input id="contentOsPassword" type="password" autocomplete="current-password" required style="width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#030914;color:white;outline:none;margin-bottom:18px"/>
        <button id="contentOsLoginBtn" type="submit" style="width:100%;padding:13px 16px;border:0;border-radius:12px;background:white;color:#07101c;font-weight:700;cursor:pointer">Entrar a Content OS</button>
        <div id="contentOsLoginError" style="min-height:20px;margin-top:12px;font-size:12px;color:#f7a8a8"></div>
      </form>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#contentOsLoginForm').addEventListener('submit',async(e)=>{
        e.preventDefault();
        const btn=overlay.querySelector('#contentOsLoginBtn');
        const errorEl=overlay.querySelector('#contentOsLoginError');
        btn.disabled=true;btn.textContent='Validando...';errorEl.textContent='';
        try{
          const response=await originalFetch('/api/content-os/auth',{
            method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',
            body:JSON.stringify({username:overlay.querySelector('#contentOsUser').value,password:overlay.querySelector('#contentOsPassword').value})
          });
          const data=await response.json().catch(()=>({}));
          if(!response.ok||!data.ok) throw new Error(data.error||'No se pudo iniciar sesión');
          authenticated=true;checking=false;
          window.ContentOSAuth.waiting=false;window.ContentOSAuth.authenticated=true;
          overlay.remove();
          resolveAuth(true);
        }catch(error){
          errorEl.textContent=error.message||'Credenciales incorrectas';
        }finally{
          btn.disabled=false;btn.textContent='Entrar a Content OS';
        }
      });
    }
    const errorEl=overlay.querySelector('#contentOsLoginError');
    if(message&&errorEl) errorEl.textContent=message;
    setTimeout(()=>overlay.querySelector('#contentOsUser')?.focus(),30);
  }

  async function checkSession(){
    try{
      const response=await originalFetch('/api/content-os/auth',{cache:'no-store',credentials:'same-origin'});
      if(response.ok){
        authenticated=true;checking=false;
        window.ContentOSAuth.waiting=false;window.ContentOSAuth.authenticated=true;
        resolveAuth(true);
        return;
      }
    }catch(_e){}
    showLogin();
  }

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(url.includes('/api/content-os/live-data')){
      if(!authenticated) await authReady;
    }
    return originalFetch(input,init);
  };

  checkSession();
})();
