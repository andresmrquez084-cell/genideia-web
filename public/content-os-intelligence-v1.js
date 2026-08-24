/* GENIDEIA Content OS — Intelligence V1
   Evidence-first learning engine. Never upgrades a coincidence into a causal rule.
*/
(function(){
  const HOOK_TYPES=['curiosidad','problema','pérdida','dinero','comparación','descubrimiento','error','tutorial','resultado','polémica'];
  const TOPICS=['ChatGPT','Claude','IA general','herramientas','B2B','productividad','otro'];
  const PROMISES=['descubrir','aprender','ahorrar tiempo','evitar errores','ganar dinero','mejorar resultados','simplificar','automatizar','otro'];
  const FORMATS=['lista','comparación','antes/después','demo','tutorial','texto','reacción','otro'];
  const KNOWLEDGE=['principiante','intermedio','avanzado'];

  const lower=v=>String(v??'').toLowerCase();
  const safeDiv=(a,b)=>Number(b)>0?Number(a||0)/Number(b):null;
  const median=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;};
  const mean=values=>{const a=values.filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;};
  const pctValue=v=>Number.isFinite(v)?`${(v*100).toFixed(v<.01?2:1)}%`:'—';
  const num=v=>Number(v||0);

  function inferElementCount(v){
    if(Number.isFinite(Number(v.elementCount))) return Number(v.elementCount);
    const text=`${v.title||''} ${v.caption||''}`.trim();
    const m=text.match(/(?:^|\s)(3|5|7|10)(?:\s|\b)/);
    return m?Number(m[1]):'otra';
  }
  function inferHookType(v){
    if(HOOK_TYPES.includes(lower(v.hookType))) return lower(v.hookType);
    const t=lower(`${v.hook||''} ${v.title||''}`);
    if(/vs\.?|versus|compar|antes.*después|antes.*ahora|contraste/.test(t)) return 'comparación';
    if(/error|mal|no uses|equivoc/.test(t)) return 'error';
    if(/dinero|ganar|vende|ventas|factur|\$|usd/.test(t)) return 'dinero';
    if(/perdés|perder|pérdida|dejar de|no debería/.test(t)) return 'pérdida';
    if(/problema|dolor|traba|falla/.test(t)) return 'problema';
    if(/cómo|tutorial|paso|hacé|hacer/.test(t)) return 'tutorial';
    if(/resultado|elimina|ahorra|recupera|convierte|logré|conseguí/.test(t)) return 'resultado';
    if(/descubr|ocult|no sabías|probablemente|secreto/.test(t)) return 'descubrimiento';
    if(/polém|nadie|mentira|sobrevalor/.test(t)) return 'polémica';
    return 'curiosidad';
  }
  function inferTopic(v){
    const t=lower(`${v.topic||''} ${v.title||''} ${v.caption||''}`);
    if(/chatgpt/.test(t)) return 'ChatGPT';
    if(/claude/.test(t)) return 'Claude';
    if(/herramient|apps|software|stack/.test(t)) return 'herramientas';
    if(/pyme|empresa|negocio|b2b|ventas|transporte|inmobiliaria|cliente/.test(t)) return 'B2B';
    if(/productiv|ahorrar tiempo|hora por día|flujo de trabajo/.test(t)) return 'productividad';
    if(/\bia\b|inteligencia artificial/.test(t)) return 'IA general';
    return 'otro';
  }
  function inferPromise(v){
    if(PROMISES.includes(lower(v.promise))) return lower(v.promise);
    const t=lower(`${v.title||''} ${v.caption||''} ${v.hook||''}`);
    if(/automat/.test(t)) return 'automatizar';
    if(/ganar|vende|ventas|dinero|factur/.test(t)) return 'ganar dinero';
    if(/ahorra|tiempo|hora|rápido/.test(t)) return 'ahorrar tiempo';
    if(/error|evitar|no uses|no debería/.test(t)) return 'evitar errores';
    if(/simplif|fácil|simple/.test(t)) return 'simplificar';
    if(/mejor|resultado|convierte|recupera/.test(t)) return 'mejorar resultados';
    if(/cómo|aprend|tutorial|guía/.test(t)) return 'aprender';
    return 'descubrir';
  }
  function inferFormat(v){
    const f=lower(v.format);
    if(/lista/.test(f)) return 'lista';
    if(/antes/.test(f)) return 'antes/después';
    if(/compar/.test(f)) return 'comparación';
    if(/demo|clon|review/.test(f)) return 'demo';
    if(/tutorial/.test(f)) return 'tutorial';
    if(/texto/.test(f)) return 'texto';
    if(/reacci/.test(f)) return 'reacción';
    const t=lower(v.title);
    if(/^\s*(3|5|7|10)\b/.test(t)) return 'lista';
    return 'otro';
  }
  function inferKnowledge(v){
    if(KNOWLEDGE.includes(lower(v.knowledgeLevel))) return lower(v.knowledgeLevel);
    const t=lower(`${v.title||''} ${v.caption||''} ${v.topic||''}`);
    if(/api|webhook|mcp|oauth|supabase|código|python|sql|developer/.test(t)) return 'avanzado';
    if(/automat|sistema|workflow|claude code|integr/.test(t)) return 'intermedio';
    return 'principiante';
  }
  function classify(v){
    return {
      elementCount:inferElementCount(v),hookType:inferHookType(v),topic:inferTopic(v),
      promise:inferPromise(v),format:inferFormat(v),knowledgeLevel:inferKnowledge(v),
      tags:Array.isArray(v.freeTags)?v.freeTags:[v.topic].filter(Boolean)
    };
  }
  function metrics(v){
    const views=num(v.views), reach=num(v.reach), saves=num(v.saves), shares=num(v.shares), comments=num(v.comments), follows=num(v.follows), profileVisits=num(v.profileVisits??v.profile_visits);
    return {
      views,reach,saves,shares,comments,follows,profileVisits,
      retention:Number.isFinite(Number(v.retention))?Number(v.retention):null,
      avgWatch:Number.isFinite(Number(v.avgWatch))?Number(v.avgWatch):null,
      completion:Number.isFinite(Number(v.completion))?Number(v.completion):null,
      saveRate:safeDiv(saves,views),shareRate:safeDiv(shares,views),commentRate:safeDiv(comments,views),
      followRate:safeDiv(follows,views),profileVisitRate:safeDiv(profileVisits,views),
      profileToFollowRate:safeDiv(follows,profileVisits)
    };
  }
  function record(v){return {...v,analysisClass:classify(v),analysisMetrics:metrics(v)};}

  const dimensions=[
    ['elementCount','cantidad de elementos'],['hookType','tipo de hook'],['topic','tema'],
    ['promise','promesa'],['format','formato'],['knowledgeLevel','nivel de conocimiento']
  ];
  const metricDefs=[
    ['views','views'],['saveRate','Save Rate'],['shareRate','Share Rate'],['commentRate','Comment Rate'],
    ['followRate','Follow Rate'],['profileVisitRate','Profile Visit Rate'],['avgWatch','tiempo medio visto'],
    ['completion','finalización'],['retention','retención']
  ];

  function observations(records){
    const rows=[];
    if(!records.length)return rows;
    const validViews=records.filter(r=>r.analysisMetrics.views>0);
    if(validViews.length){
      const top=[...validViews].sort((a,b)=>b.analysisMetrics.views-a.analysisMetrics.views).slice(0,3);
      rows.push(`Las piezas con más views de la muestra son ${top.map(x=>`“${x.title}” (${fmtN(x.analysisMetrics.views)})`).join(', ')}.`);
    }
    for(const [key,label] of [['saveRate','Save Rate'],['shareRate','Share Rate'],['followRate','Follow Rate']]){
      const ranked=records.filter(r=>Number.isFinite(r.analysisMetrics[key])).sort((a,b)=>b.analysisMetrics[key]-a.analysisMetrics[key]);
      if(ranked.length) rows.push(`${label}: “${ranked[0].title}” lidera con ${pctValue(ranked[0].analysisMetrics[key])}.`);
    }
    const snapshots=records.map(r=>Array.isArray(r.snapshots)?r.snapshots.length:Number(r.snapshotCount||0)).filter(Boolean);
    if(!snapshots.length||Math.max(...snapshots)<2) rows.push('Velocidad todavía no puede evaluarse: se necesitan múltiples snapshots por contenido.');
    return rows;
  }

  function candidateHypotheses(records){
    const out=[];
    const all=records.filter(r=>r.analysisMetrics.views>0);
    for(const [dim,label] of dimensions){
      const groups=new Map();
      for(const r of all){const val=String(r.analysisClass[dim]);if(!groups.has(val))groups.set(val,[]);groups.get(val).push(r);}
      for(const [value,group] of groups){
        if(group.length<2) continue; // never infer from one publication
        const rest=all.filter(r=>String(r.analysisClass[dim])!==value);
        if(rest.length<2) continue;
        for(const [metricKey,metricLabel] of metricDefs){
          const gVals=group.map(r=>r.analysisMetrics[metricKey]).filter(Number.isFinite);
          const rVals=rest.map(r=>r.analysisMetrics[metricKey]).filter(Number.isFinite);
          if(gVals.length<2||rVals.length<2) continue;
          const gm=median(gVals), rm=median(rVals);
          if(!Number.isFinite(gm)||!Number.isFinite(rm)||rm===0) continue;
          const lift=gm/rm-1;
          if(Math.abs(lift)<0.15) continue;
          const conf=confidence(group.length,rest.length,Math.abs(lift));
          out.push({
            dimension:dim,dimensionLabel:label,value,metricKey,metricLabel,lift,
            sample:group.length,comparisonSample:rest.length,confidence:conf,
            statement:`${label} “${value}” podría estar asociado a ${lift>0?'mejor':'menor'} ${metricLabel}.`,
            evidence:`Mediana ${metricLabel}: ${formatMetric(metricKey,gm)} en ${group.length} piezas vs. ${formatMetric(metricKey,rm)} en ${rest.length} piezas del resto de la muestra.`,
            confounders:confoundersFor(dim),
            nextExperiment:experimentText(dim,value,metricLabel),
            status:'Hipótesis — no causal'
          });
        }
      }
    }
    return dedupe(out).sort((a,b)=>confidenceRank(b.confidence)-confidenceRank(a.confidence)||Math.abs(b.lift)-Math.abs(a.lift)).slice(0,8);
  }
  function confidence(a,b,lift){
    const n=Math.min(a,b);
    if(n>=6&&lift>=.30)return 'Alto';
    if(n>=3&&lift>=.20)return 'Medio';
    return 'Bajo';
  }
  function confidenceRank(c){return c==='Alto'?3:c==='Medio'?2:1;}
  function confoundersFor(dim){
    return dimensions.filter(([d])=>d!==dim).map(([,l])=>l).slice(0,4).concat(['momento de publicación','tamaño de audiencia al publicar']);
  }
  function experimentText(dim,value,metric){
    const names={elementCount:'cantidad de elementos',hookType:'tipo de hook',topic:'tema',promise:'promesa',format:'formato',knowledgeLevel:'nivel de conocimiento'};
    return `Publicar al menos 3 pares comparables manteniendo tema, hook y formato lo más constantes posible; variar ${names[dim]||dim} (incluyendo “${value}”) y comparar ${metric}.`;
  }
  function dedupe(items){
    const seen=new Set();return items.filter(x=>{const k=`${x.dimension}:${x.value}:${x.metricKey}`;if(seen.has(k))return false;seen.add(k);return true;});
  }

  function velocity(v){
    const s=(Array.isArray(v.snapshots)?v.snapshots:[]).filter(x=>Number.isFinite(Number(x.views))&&x.capturedAt).sort((a,b)=>new Date(a.capturedAt)-new Date(b.capturedAt));
    if(s.length<3)return {status:'Datos insuficientes',detail:'Se requieren al menos 3 snapshots.'};
    const rateBetween=(a,b)=>{const h=(new Date(b.capturedAt)-new Date(a.capturedAt))/36e5;return h>0?(num(b.views)-num(a.views))/h:null;};
    const prev=rateBetween(s[s.length-3],s[s.length-2]),cur=rateBetween(s[s.length-2],s[s.length-1]);
    if(!Number.isFinite(prev)||!Number.isFinite(cur))return {status:'Datos insuficientes',detail:'No se pudo calcular la velocidad.'};
    if(cur>=prev*1.2)return {status:'Acelerando',detail:`${fmtN(cur)} views/h vs ${fmtN(prev)} views/h en el tramo previo.`};
    if(cur<=prev*.8)return {status:'Frenándose',detail:`${fmtN(cur)} views/h vs ${fmtN(prev)} views/h en el tramo previo.`};
    return {status:'Estable',detail:`${fmtN(cur)} views/h, similar al tramo previo (${fmtN(prev)} views/h).`};
  }

  function confirmedRules(){
    // Rules are intentionally explicit/persisted. The engine never promotes a hypothesis by itself.
    return Array.isArray(window.contentOsConfirmedRules)?window.contentOsConfirmedRules:[];
  }
  function report(source){
    const records=(source||window.content||[]).filter(v=>v.status!=='Idea'&&v.status!=='Guion').map(record);
    return {records,observations:observations(records),hypotheses:candidateHypotheses(records),rules:confirmedRules()};
  }
  function fmtN(n){n=num(n);return n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:String(Math.round(n));}
  function formatMetric(k,v){return /Rate|completion|retention/.test(k)?pctValue(v):k==='avgWatch'?`${Number(v).toFixed(1)} s`:fmtN(v);}

  window.ContentOSIntelligence={classify,metrics,record,report,velocity,pctValue,formatMetric,HOOK_TYPES,TOPICS,PROMISES,FORMATS,KNOWLEDGE};
})();
