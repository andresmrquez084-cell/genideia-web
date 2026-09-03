(()=>{
  const PROJECT_ID='dbwuubabafzsinaokawe';
  const BUCKET='genideia-videos';
  const VIDEO_BASE=`https://${PROJECT_ID}.supabase.co/storage/v1/object/public/${BUCKET}/portfolio`;
  const style=document.createElement('style');
  style.textContent='.modalhead video{width:100%;height:100%;object-fit:contain;background:#020817;display:block}.techVideoFallback{position:absolute!important;inset:0;z-index:1}.techVideoHint{color:#718ba7;font-size:12px;margin-top:15px}';
  document.head.appendChild(style);

  // video:true  -> la ficha incluye reproductor (se sirve desde la biblioteca de videos)
  // video:false -> la ficha explica el recorrido sin reproductor
  const TECHNICAL={
    tms:{title:'GENIDEIA TMS · recorrido técnico',desc:'Desde que entra una solicitud hasta que queda registrada, asignada y disponible para seguimiento.',flow:['Solicitud','Registro de datos','Asignación','Alerta','Seguimiento'],video:true},
    os:{title:'GENIDEIA OS · recorrido técnico',desc:'Cómo un cliente, diagnóstico y proyecto se convierten en prioridades y acciones visibles para el equipo.',flow:['Cliente','Diagnóstico','Prioridad','Tarea','Resultado'],video:false},
    bot:{title:'WhatsApp + IA · recorrido técnico',desc:'Cómo una consulta se interpreta, se conecta con disponibilidad y se transforma en una respuesta, reserva o seguimiento.',flow:['Consulta','Intención','Disponibilidad','Agenda','Seguimiento'],video:false}
  };

  window.openTechnical=function(id){
    const technical=TECHNICAL[id]; if(!technical)return;
    const head=document.getElementById('modalHead');
    const content=document.getElementById('modalContent');
    const flowChips=technical.flow.map(x=>`<span class="chip">${x}</span>`).join('');

    if(technical.video){
      const videoUrl=`${VIDEO_BASE}/${id}.mp4`;
      head.innerHTML=`<button class="close" onclick="closeModal()">×</button><video id="technicalVideo" controls playsinline preload="metadata" src="${videoUrl}?v=${Date.now()}"></video><div id="technicalFallback" class="placeholder techVideoFallback"><div class="picon">GII</div><b>RECORRIDO TÉCNICO</b><small>El video se habilita automáticamente cuando está cargado.</small></div>`;
      const video=document.getElementById('technicalVideo'),fallback=document.getElementById('technicalFallback');
      video.addEventListener('loadeddata',()=>{fallback.style.display='none'});
      video.addEventListener('error',()=>{fallback.style.display='flex'});
      content.innerHTML=`<div class="meta"><span class="badge own">SISTEMA DESTACADO</span></div><h2>${technical.title}</h2><p class="desc">${technical.desc}</p><div class="flow">${flowChips}</div><div class="columns"><div class="box"><h4>Qué muestra el video</h4><p>El recorrido real de pantalla, acompañado por el flujo de información y las decisiones que activan cada paso.</p></div><div class="box"><h4>La parte técnica</h4><p>Interfaz, datos, automatizaciones, integraciones y la forma en que se conserva trazabilidad sin depender de tareas manuales.</p></div></div><div class="modalactions"><a class="btn primary" href="${videoUrl}" target="_blank" rel="noopener">Abrir video ↗</a></div><div class="techVideoHint">El archivo se sirve desde la biblioteca de videos de GENIDEIA y puede reemplazarse sin volver a desplegar el portfolio.</div>`;
    }else{
      head.innerHTML=`<button class="close" onclick="closeModal()">×</button><div class="placeholder"><div class="picon">GII</div><b>RECORRIDO TÉCNICO</b><small>Flujo operativo · arquitectura</small></div>`;
      content.innerHTML=`<div class="meta"><span class="badge own">SISTEMA DESTACADO</span></div><h2>${technical.title}</h2><p class="desc">${technical.desc}</p><div class="flow">${flowChips}</div><div class="columns"><div class="box"><h4>Qué recorre</h4><p>El paso a paso de la información: qué entra, cómo se registra, qué decisiones se automatizan y dónde queda la trazabilidad de cada movimiento.</p></div><div class="box"><h4>La parte técnica</h4><p>Interfaz, datos, automatizaciones, integraciones y la forma en que se conserva trazabilidad sin depender de tareas manuales.</p></div></div>`;
    }

    document.getElementById('modal').classList.add('open');document.body.style.overflow='hidden';
  };
})();
