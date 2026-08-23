const navItems=[
  ['Resumen','⌂'],['Contenido','▣'],['Métricas','⌁'],['Patrones','✦'],['Competencia','◌'],['Ideas','◈'],['Stories','▥'],['Replicar','↻'],['Personaje','◇'],['Configuración','⚙']
];
let currentPage='Resumen';
const primaryWorkspaceId='f2a0c61f-160c-4300-aac6-dcb8c89d98d7';
let systemHealth={supabase:false,instagram:false,instagramApp:false};
const workspaceState={
  activeId:primaryWorkspaceId,
  workspaces:[
    {id:primaryWorkspaceId,name:'Andrés',type:'Marca personal',kind:'personal',accounts:[{platform:'Instagram',handle:'Pendiente de conectar',status:'pending'}]}
  ]
};
function activeWorkspace(){return workspaceState.workspaces.find(w=>w.id===workspaceState.activeId)||workspaceState.workspaces[0]}
function workspaceInitials(name){return String(name||'OS').split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()}

const formatIcon={Lista:'≡',Tutorial:'▷',Review:'◇','Antes vs ahora':'↔',Clon:'◎','Demo':'▤','Opinión':'✦'};
const content=[
{id:1,title:'5 herramientas de IA que usaría para cada tarea',platform:'Instagram',date:'22 ago',format:'Lista',topic:'Herramientas IA',intent:'Guardados',audience:'B2C',hook:'Número + utilidad',duration:34,views:28200,reach:24100,saves:2910,shares:1240,likes:3260,comments:142,follows:214,avgWatch:23.8,status:'Publicado'},
{id:2,title:'10 cosas que no sabías que podías hacer con IA',platform:'Instagram',date:'21 ago',format:'Lista',topic:'IA general',intent:'Compartidos',audience:'B2C',hook:'Número + curiosidad',duration:41,views:31600,reach:26700,saves:2630,shares:1890,likes:3710,comments:176,follows:282,avgWatch:28.4,status:'Publicado'},
{id:3,title:'Este seguimiento recupera ventas que hoy perdés',platform:'Instagram',date:'20 ago',format:'Demo',topic:'Automatización',intent:'Autoridad',audience:'B2B',hook:'Problema + resultado',duration:49,views:7800,reach:6900,saves:510,shares:328,likes:900,comments:61,follows:72,avgWatch:31.4,status:'Publicado'},
{id:4,title:'Claude Code me elimina horas de trabajo',platform:'Instagram',date:'20 ago',format:'Demo',topic:'Claude',intent:'Seguidores',audience:'B2C',hook:'Resultado concreto',duration:45,views:13200,reach:11600,saves:980,shares:490,likes:1510,comments:89,follows:164,avgWatch:29.8,status:'Publicado'},
{id:5,title:'5 tareas que una PYME no debería seguir haciendo a mano',platform:'Instagram',date:'19 ago',format:'Lista',topic:'PYMES',intent:'Compartidos',audience:'B2B',hook:'Número + dolor',duration:39,views:9900,reach:8500,saves:820,shares:620,likes:1040,comments:83,follows:91,avgWatch:25.1,status:'Publicado'},
{id:6,title:'Antes vs ahora: cómo respondés consultas con IA',platform:'Instagram',date:'18 ago',format:'Antes vs ahora',topic:'Ventas',intent:'Compartidos',audience:'B2B',hook:'Contraste',duration:32,views:12100,reach:10600,saves:730,shares:790,likes:1310,comments:71,follows:118,avgWatch:23.5,status:'Publicado'},
{id:7,title:'ChatGPT vende tus cosas mientras dormís',platform:'Instagram',date:'17 ago',format:'Clon',topic:'ChatGPT',intent:'Seguidores',audience:'B2C',hook:'Resultado inesperado',duration:51,views:18600,reach:15800,saves:1440,shares:710,likes:2240,comments:104,follows:238,avgWatch:30.1,status:'Publicado'},
{id:8,title:'El sistema que usaría una empresa de transporte',platform:'Instagram',date:'16 ago',format:'Demo',topic:'Transporte',intent:'Autoridad',audience:'B2B',hook:'Caso real',duration:57,views:6100,reach:5400,saves:420,shares:212,likes:690,comments:49,follows:54,avgWatch:33.4,status:'Publicado'},
{id:9,title:'7 prompts de ChatGPT que sí sirven',platform:'TikTok',date:'15 ago',format:'Lista',topic:'ChatGPT',intent:'Guardados',audience:'B2C',hook:'Número + utilidad',duration:38,views:22900,reach:20900,saves:2010,shares:880,likes:2800,comments:133,follows:191,avgWatch:24.9,status:'Publicado'},
{id:10,title:'La landing que convertía mal por este error',platform:'Instagram',date:'14 ago',format:'Review',topic:'Marketing',intent:'Autoridad',audience:'B2B',hook:'Error + diagnóstico',duration:44,views:7200,reach:6400,saves:490,shares:260,likes:810,comments:55,follows:65,avgWatch:28.2,status:'Publicado'},
{id:11,title:'5 herramientas para ahorrar 1 hora por día',platform:'Instagram',date:'—',format:'Lista',topic:'Productividad',intent:'Guardados',audience:'B2C',hook:'Número + resultado',duration:33,views:0,reach:0,saves:0,shares:0,likes:0,comments:0,follows:0,avgWatch:0,status:'Guion'},
{id:12,title:'Qué puede automatizar realmente una inmobiliaria',platform:'Instagram',date:'—',format:'Demo',topic:'Inmobiliaria',intent:'Autoridad',audience:'B2B',hook:'Pregunta concreta',duration:52,views:0,reach:0,saves:0,shares:0,likes:0,comments:0,follows:0,avgWatch:0,status:'Idea'}
];
let selectedId=1;
const fmt=n=>n>=1000000?(n/1000000).toFixed(1)+'M':n>=1000?(n/1000).toFixed(1)+'K':String(n);
const pct=n=>`${(n*100).toFixed(1)}%`;
const rate=(a,b)=>b? a/b:0;
const published=()=>content.filter(x=>x.status==='Publicado');
const sum=k=>published().reduce((a,x)=>a+x[k],0);
function baseline(k){const vals=published().map(x=>x[k]).sort((a,b)=>a-b);return vals[Math.floor(vals.length/2)]||0}
function scoreVideo(v){if(!v.reach)return 0;const s=rate(v.saves,v.reach),sh=rate(v.shares,v.reach),f=rate(v.follows,v.reach),w=rate(v.avgWatch,v.duration);return Math.min(99,Math.round((s/.08*28)+(sh/.06*26)+(f/.015*22)+(w/.75*24)))}

const competitorVideos=[
{id:101,creator:'Creator IA A',title:'5 funciones ocultas de ChatGPT que parecen ilegales',views:2400000,likes:164000,comments:3210,shares:31800,age:'3 días',format:'Lista',topic:'ChatGPT',hook:'Número + curiosidad',viral:9.4,intent:'Compartidos'},
{id:102,creator:'Creator IA B',title:'Esta IA edita tu video borrando texto',views:1800000,likes:121000,comments:2470,shares:22600,age:'5 días',format:'Demo',topic:'Edición IA',hook:'Resultado visual',viral:8.8,intent:'Guardados'},
{id:103,creator:'Creator Negocios',title:'3 tareas que tu empresa ya no debería hacer manualmente',views:980000,likes:51700,comments:1940,shares:14100,age:'7 días',format:'Lista',topic:'Automatización',hook:'Número + dolor',viral:7.9,intent:'Autoridad'},
{id:104,creator:'Creator Tech',title:'Probé 10 herramientas de IA y solo usaría estas 3',views:3200000,likes:218000,comments:4920,shares:40700,age:'9 días',format:'Review',topic:'Herramientas IA',hook:'Prueba + selección',viral:9.7,intent:'Seguidores'},
{id:105,creator:'Creator Marketing',title:'Así convierto un video largo en 12 reels',views:1250000,likes:79300,comments:1830,shares:19200,age:'12 días',format:'Demo',topic:'Contenido',hook:'Antes + resultado',viral:8.2,intent:'Guardados'},
{id:106,creator:'Creator IA C',title:'No uses ChatGPT así. Hacé esto en cambio',views:760000,likes:48600,comments:2200,shares:10200,age:'2 días',format:'Tutorial',topic:'ChatGPT',hook:'Error + corrección',viral:7.4,intent:'Comentarios'}
];
const storySequences=[
{id:201,name:'Venta — Diagnóstico IA',intent:'Venta',status:'Lista para publicar',frames:[
{role:'1 · Atención',copy:'¿Cuántas consultas repetidas responde tu equipo por día?',cta:'Encuesta: 0–10 / 10–30 / +30'},
{role:'2 · Problema',copy:'Cuando todas dependen de una persona, el problema no es la cantidad: es el sistema.',cta:'Continuar →'},
{role:'3 · Prueba',copy:'Este flujo filtra, responde y deriva solo las consultas que necesitan atención humana.',cta:'Ver demo'},
{role:'4 · Oferta',copy:'Estoy abriendo diagnósticos para detectar qué tareas podrías sacar del trabajo manual.',cta:'Quiero verlo'},
{role:'5 · Acción',copy:'Respondé “DIAGNÓSTICO” y te muestro dónde empezaría.',cta:'Sticker de respuesta'}]},
{id:202,name:'Interacción — Herramientas IA',intent:'Interacción',status:'Borrador',frames:[
{role:'1 · Hook',copy:'De estas 4 herramientas, ¿cuál usás más?',cta:'Encuesta'},
{role:'2 · Elección',copy:'ChatGPT vs Claude',cta:'Votación'},
{role:'3 · Elección',copy:'NotebookLM vs Perplexity',cta:'Votación'},
{role:'4 · Insight',copy:'Mañana comparo las dos más votadas con un caso real.',cta:'Activá recordatorio'},
{role:'5 · Conversación',copy:'¿Qué tarea querés que pruebe?',cta:'Caja de preguntas'}]},
{id:203,name:'Venta — Content OS',intent:'Venta',status:'Idea',frames:[
{role:'1 · Dolor',copy:'Publicar mucho no sirve si no sabés por qué algo funcionó.',cta:'Seguir'},
{role:'2 · Contraste',copy:'Views te dicen qué pasó. Un sistema de aprendizaje te dice qué repetir.',cta:'Seguir'},
{role:'3 · Producto',copy:'Estoy construyendo un Content OS para formatos, hooks, temas e intención.',cta:'Ver pantalla'},
{role:'4 · Prueba',copy:'El objetivo: detectar patrones y convertirlos en el próximo video.',cta:'¿Te sirve?'},
{role:'5 · CTA',copy:'Si querés que muestre el proceso, respondé “OS”.',cta:'Respuesta'}]}
];
let selectedStory=201;
const brandPersona={
name:'Andrew / GENIDEIA',archetype:'Experimentador estratégico',promise:'Probar sistemas, entender por qué funcionan y convertirlos en algo aplicable.',traits:[['Curioso',92],['Práctico',95],['Innovador',90],['Cercano',82],['Analítico',88],['Directo',86]],
pillars:[
['Experimento','Mostrar cosas que realmente probaste o construiste, no solo teoría.'],
['Traducción','Explicar tecnología y comportamiento en lenguaje simple y accionable.'],
['Construcción','Que la audiencia te vea creando sistemas, prototipos y procesos reales.']
],
do:['Primera persona','Casos reales','Demostraciones','Conclusiones propias','Lenguaje simple'],
avoid:['Guruísmo','Promesas absolutas','Jerga técnica innecesaria','Copiar tendencias sin ángulo propio']
};

const contentOutcomes={
  1:{objective:'Guardados',action:'Guardar / compartir',result:'2.9K guardados',conversations:4,leads:1,meetings:0,proposals:0,sales:0,revenue:0},
  2:{objective:'Alcance + compartidos',action:'Compartir',result:'1.9K compartidos',conversations:7,leads:1,meetings:0,proposals:0,sales:0,revenue:0},
  3:{objective:'Leads B2B',action:'DM “SISTEMA”',result:'14 leads · 1 venta',conversations:22,leads:14,meetings:5,proposals:2,sales:1,revenue:1200},
  4:{objective:'Seguidores',action:'Seguir perfil',result:'+164 seguidores',conversations:3,leads:0,meetings:0,proposals:0,sales:0,revenue:0},
  5:{objective:'Leads B2B',action:'DM / perfil',result:'9 leads · 1 venta',conversations:18,leads:9,meetings:3,proposals:2,sales:1,revenue:650},
  6:{objective:'Conversación',action:'Responder / DM',result:'7 leads · 1 venta',conversations:16,leads:7,meetings:2,proposals:2,sales:1,revenue:800},
  7:{objective:'Seguidores',action:'Seguir + compartir',result:'+238 seguidores',conversations:5,leads:0,meetings:0,proposals:0,sales:0,revenue:0},
  8:{objective:'Autoridad B2B',action:'Consultar caso',result:'5 leads · 2 reuniones',conversations:12,leads:5,meetings:2,proposals:1,sales:0,revenue:0},
  9:{objective:'Guardados',action:'Guardar',result:'2.0K guardados',conversations:2,leads:0,meetings:0,proposals:0,sales:0,revenue:0},
  10:{objective:'Diagnóstico',action:'Visitar perfil',result:'3 leads',conversations:10,leads:3,meetings:0,proposals:0,sales:0,revenue:0}
};
const mainFunnel=[
  {label:'Alcance',value:186400,sub:'personas expuestas',tone:'attention'},
  {label:'Visitas al perfil',value:4820,sub:'2.6% del alcance',tone:'attention'},
  {label:'Acciones de intención',value:614,sub:'guardar · responder · click',tone:'reaction'},
  {label:'Conversaciones',value:97,sub:'DMs / WhatsApp',tone:'relationship'},
  {label:'Leads',value:31,sub:'potenciales clientes',tone:'relationship'},
  {label:'Reuniones',value:12,sub:'diagnósticos / calls',tone:'relationship'},
  {label:'Propuestas',value:8,sub:'oportunidades abiertas',tone:'business'},
  {label:'Ventas',value:5,sub:'clientes cerrados',tone:'business'}
];
const businessSummary={revenue:4850,pipeline:9200,avgTicket:970,leadToSale:16.1};
const leads=[
  {id:301,name:'Carlos R.',company:'Transporte',source:'Reel',content:'Este seguimiento recupera ventas que hoy perdés',stage:'Propuesta enviada',value:1200,next:'Retomar propuesta y resolver objeciones',due:'Hoy',heat:'hot',timeline:[['22 ago','Respondió “SISTEMA” al Reel'],['22 ago','Conversación calificada por DM'],['23 ago','Diagnóstico agendado'],['24 ago','Propuesta enviada']]},
  {id:302,name:'Lucía M.',company:'Centro estético',source:'Story',content:'Venta — Diagnóstico IA',stage:'Conversación',value:650,next:'Preguntar por volumen de consultas',due:'Hoy',heat:'hot',timeline:[['21 ago','Respondió Story con “DIAGNÓSTICO”'],['21 ago','Se envió pregunta de calificación'],['22 ago','Esperando respuesta']]},
  {id:303,name:'Martín S.',company:'Gimnasio',source:'Reel',content:'5 tareas que una PYME no debería seguir haciendo a mano',stage:'Reunión realizada',value:900,next:'Preparar propuesta',due:'Mañana',heat:'warm',timeline:[['19 ago','Visitó perfil desde Reel'],['20 ago','Inició conversación'],['21 ago','Reunión realizada']]},
  {id:304,name:'Federico P.',company:'Inmobiliaria',source:'Story',content:'Venta — Diagnóstico IA',stage:'Seguimiento',value:750,next:'Enviar caso similar + CTA a reunión',due:'2 días',heat:'warm',timeline:[['18 ago','Click en CTA de Story'],['18 ago','Conversación inicial'],['20 ago','Sin respuesta luego de propuesta de llamada']]},
  {id:305,name:'Sofía A.',company:'Servicios B2B',source:'Reel',content:'Antes vs ahora: cómo respondés consultas con IA',stage:'Reunión agendada',value:1350,next:'Preparar diagnóstico',due:'3 días',heat:'warm',timeline:[['20 ago','Compartió Reel'],['20 ago','Entró al perfil'],['21 ago','Envió DM'],['22 ago','Reunión agendada']]}
];
const storyOutcomes={
  201:{reach:8400,replies:184,conversations:34,leads:13,meetings:5,sales:2,revenue:1650},
  202:{reach:9700,replies:430,conversations:118,leads:2,meetings:0,sales:0,revenue:0},
  203:{reach:6200,replies:96,conversations:29,leads:8,meetings:3,sales:1,revenue:900}
};
function commercial(v){return contentOutcomes[v.id]||{objective:v.intent,action:'Por definir',result:v.status==='Publicado'?'Sin atribución comercial':'Pendiente de publicar',conversations:0,leads:0,meetings:0,proposals:0,sales:0,revenue:0}}
function interactionTotal(v){return (v.likes||0)+(v.comments||0)+(v.saves||0)+(v.shares||0)}
function attentionScore(v){if(!v.reach)return 0;return Math.min(99,Math.round(40*Math.min(1,v.reach/20000)+35*Math.min(1,rate(v.avgWatch,v.duration)/.7)+25*Math.min(1,rate(v.views,v.reach)/1.15)))}
function engagementScore(v){if(!v.reach)return 0;return Math.min(99,Math.round(35*Math.min(1,rate(v.saves,v.reach)/.08)+35*Math.min(1,rate(v.shares,v.reach)/.06)+30*Math.min(1,rate((v.comments||0)+(v.likes||0),v.reach)/.12)))}
function relationshipScore(v){if(!v.reach)return 0;const c=commercial(v);return Math.min(99,Math.round(45*Math.min(1,rate(v.follows,v.reach)/.015)+35*Math.min(1,c.conversations/20)+20*Math.min(1,c.leads/10)))}
function businessScore(v){const c=commercial(v);return Math.min(99,Math.round(30*Math.min(1,c.leads/10)+25*Math.min(1,c.meetings/4)+25*Math.min(1,c.sales/1)+20*Math.min(1,c.revenue/1000)))}
function valueScores(v){return [['Attention',attentionScore(v)],['Engagement',engagementScore(v)],['Relationship',relationshipScore(v)],['Business',businessScore(v)]]}
function funnelHTML(data=mainFunnel){return `<div class="funnel-chain">${data.map((s,i)=>`<div class="funnel-step ${s.tone||''}"><span class="stage">${s.label}</span><strong>${typeof s.value==='number'?fmt(s.value):s.value}</strong><small>${s.sub||''}</small>${i?`<small class="funnel-rate">${Math.round((Number(s.value)||0)/(Number(data[i-1].value)||1)*100)}% desde anterior</small>`:''}</div>`).join('')}</div>`}
function followupsHTML(){return `<div class="followup-list">${leads.slice(0,4).map(l=>`<div class="followup-row" data-lead="${l.id}"><div class="lead-avatar">${l.name.split(' ').map(x=>x[0]).join('').slice(0,2)}</div><div class="followup-main"><strong>${l.name} · ${l.company}</strong><small>${l.stage} · origen: ${l.source}</small><small>${l.next}</small></div><div class="followup-side"><strong>USD ${l.value}</strong><small class="${l.heat==='hot'?'due-hot':'due-ok'}">${l.due}</small></div></div>`).join('')}</div>`}
function scoreBlocks(v){return `<div class="value-scores">${valueScores(v).map(([name,val])=>`<div class="value-score"><span>${name}</span><strong>${val}</strong><i style="--w:${val}%"></i></div>`).join('')}</div>`}
function miniJourney(v){const c=commercial(v);const nodes=[['Reach',v.reach],['Convers.',c.conversations],['Leads',c.leads],['Reuniones',c.meetings],['Ventas',c.sales]];return `<div class="journey-mini">${nodes.map((n,i)=>`${i?'<span class="journey-arrow">→</span>':''}<div class="journey-node"><span>${n[0]}</span><strong>${fmt(n[1])}</strong></div>`).join('')}</div>`}
function storyFunnel(seq){const o=storyOutcomes[seq.id]||{reach:0,replies:0,conversations:0,leads:0,meetings:0,sales:0,revenue:0};const data=[{label:'Reach',value:o.reach,sub:'secuencia',tone:'attention'},{label:'Respuestas',value:o.replies,sub:'acción directa',tone:'reaction'},{label:'Conversaciones',value:o.conversations,sub:'DMs iniciados',tone:'relationship'},{label:'Leads',value:o.leads,sub:'calificados',tone:'relationship'},{label:'Reuniones',value:o.meetings,sub:'agendadas',tone:'business'},{label:'Ventas',value:o.sales,sub:`USD ${fmt(o.revenue)}`,tone:'business'}];return funnelHTML(data)}
function competitorCard(v){return `<div class="card viral-card"><div class="viral-cover">▶</div><div class="viral-body"><div class="pattern-head"><span class="chip">${v.creator}</span><span class="chip green">${v.viral}× viral</span></div><div class="viral-title">${v.title}</div><div class="viral-meta"><span class="chip">${v.format}</span><span class="chip">${v.topic}</span><span class="chip">${v.hook}</span></div><div class="viral-metrics"><div><span>Views</span><b>${fmt(v.views)}</b></div><div><span>Shares</span><b>${fmt(v.shares)}</b></div><div><span>Hace</span><b>${v.age}</b></div></div><button class="btn ghost use-competitor" data-comp="${v.id}" style="width:100%;margin-top:10px">Extraer patrón</button></div></div>`}
function storyFrames(seq){return seq.frames.map((f,i)=>`<div class="story-frame"><div><div class="story-number">STORY ${i+1}/5</div><div class="story-role">${f.role}</div></div><div class="story-copy">${f.copy}</div><div><div class="story-cta">${f.cta}</div><div class="story-metric">Métrica: ${seq.intent==='Venta'?(i<3?'avance / retención':'respuestas / clicks'):(i<3?'votos / respuestas':'participación')}</div></div></div>`).join('')}
function personaMeter([name,value]){return `<div class="persona-meter"><span>${name}</span><div class="bar"><i style="width:${value}%;background:linear-gradient(90deg,#0879d5,#16cfff)"></i></div><strong>${value}%</strong></div>`}
