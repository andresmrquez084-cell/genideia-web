/* GENIDEIA Content OS — provisional inference layer for real imported content */
(function(){
  let applied=false;
  function apply(){
    if(applied) return true;
    const live=window.ContentOSLiveData?.state;
    const engine=window.ContentOSIntelligence;
    if(!live?.loaded||!engine||typeof content==='undefined'||!Array.isArray(content)) return false;

    let inferred=0;
    for(const item of content){
      const needsTopic=!item.topic||item.topic==='Sin clasificar';
      const needsHook=!item.hook||item.hook==='Sin clasificar'||item.hook==='Por clasificar';
      if(!needsTopic&&!needsHook) continue;
      const c=engine.classify(item);
      if(needsTopic) item.topic=c.topic;
      if(needsHook) item.hook=c.hookType;
      if(!item.promise) item.promise=c.promise;
      if(!item.knowledgeLevel) item.knowledgeLevel=c.knowledgeLevel;
      if(!item.elementCount) item.elementCount=c.elementCount;
      if(!item.format||item.format==='Por clasificar') item.format=c.format;
      item.classificationSource='inferred';
      inferred++;
    }

    const persisted=Number(live.payload?.counts?.classifications||0);
    window.ContentOSInference={applied:true,inferred,persisted,total:content.length};
    applied=true;
    try{ render(); }catch(_e){}

    const top=document.querySelector('.top-actions');
    if(top&&!document.getElementById('contentOsInferenceBadge')){
      const badge=document.createElement('span');
      badge.id='contentOsInferenceBadge';
      badge.className='chip amber';
      badge.title='Clasificación automática provisional. Hook, tema, intención y audiencia todavía pueden requerir revisión manual.';
      badge.textContent=`${persisted||inferred} piezas clasificadas`;
      top.prepend(badge);
    }
    return true;
  }
  const timer=setInterval(()=>{if(apply())clearInterval(timer);},120);
  setTimeout(()=>clearInterval(timer),12000);
})();
