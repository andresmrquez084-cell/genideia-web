document.addEventListener("DOMContentLoaded",()=>{
  const addHub=(moduleId,html)=>{
    const block=document.querySelector('.modblock[data-module="'+moduleId+'"] .screen');
    if(block && !block.querySelector('.module-materials-hub')){
      const wrap=document.createElement('div');
      wrap.className='module-materials-hub';
      wrap.innerHTML=html;
      const lead=block.querySelector('.lead');
      if(lead) lead.insertAdjacentElement('afterend',wrap);
      else block.appendChild(wrap);
    }
  };
  const style=document.createElement('style');
  style.textContent='.module-materials-hub{margin:24px 0 30px;padding:20px;border:1px solid #284560;border-radius:18px;background:linear-gradient(135deg,rgba(13,31,50,.92),rgba(7,19,32,.78))}.module-materials-hub h3{margin:0 0 14px}.materials-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.material-card{display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid #263d58;border-radius:14px;background:#081522}.material-card p{color:#92a3bd;font-size:13px;line-height:1.45;flex:1}.material-link{display:inline-flex;justify-content:center;text-decoration:none;border:1px solid #31516e;background:#0d1b2d;color:#ccefff;padding:9px 11px;border-radius:9px;font-size:13px;font-weight:700}.material-link.primary{background:#49c7ff;border-color:#49c7ff;color:#03121e}@media(max-width:900px){.materials-grid{grid-template-columns:1fr}}';
  document.head.appendChild(style);
  addHub(1,'<h3>Módulo 01 · Material de la sesión</h3><div class="materials-grid" style="grid-template-columns:1fr"><div class="material-card"><strong>Grabación de la clase</strong><p>Sesión completa de diagnóstico y preparación.</p><a class="material-link primary" target="_blank" rel="noopener" href="https://drive.google.com/file/d/1C3ZZUkbMPikeogSpoJuLzAIXHPz5O0Kj/view?usp=drivesdk">Ver grabación ↗</a></div></div>');
  addHub(2,'<h3>Módulo 02 · Material del módulo</h3><div class="materials-grid"><div class="material-card"><strong>Presentación interactiva</strong><p>Deck animado utilizado durante la clase.</p><a class="material-link primary" target="_blank" rel="noopener" href="/modulos/02/presentacion.html">Abrir presentación ↗</a></div><div class="material-card"><strong>Grabación</strong><p>Clase 02 · Cómo hablar con la IA.</p><a class="material-link" target="_blank" rel="noopener" href="https://drive.google.com/file/d/1sbNn62AlJHLwspIblsHjwhq817qK7aZP/view?usp=drivesdk">Ver grabación ↗</a></div><div class="material-card"><strong>Recursos</strong><p>Prompts, loops, workflows y plantillas.</p><a class="material-link" target="_blank" rel="noopener" href="https://drive.google.com/drive/folders/1jarrK2eJb6-RiaA5NWFLZZJH6WXXGOec?usp=drive_link">Abrir carpeta ↗</a></div><div class="material-card"><strong>Tarea</strong><p>Aplicar el procedimiento completo a otra tarea real.</p><a class="material-link" href="#" onclick="event.preventDefault(); if(window.go){go(7)}">Ver tarea</a></div></div>');
});