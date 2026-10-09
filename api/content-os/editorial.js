import crypto from 'node:crypto';
import { verifyContentOsSession } from '../../lib/content-os-session.js';
const WORKSPACE = process.env.CONTENT_OS_WORKSPACE_ID || 'f2a0c61f-160c-4300-aac6-dcb8c89d98d7';
const BASE = process.env.CONTENT_OS_SUPABASE_URL || 'https://dbwuubabafzsinaokawe.supabase.co';
const KEY = () => process.env.CONTENT_OS_SUPABASE_SECRET_KEY || process.env.CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY;
function auth(req){
 const session=verifyContentOsSession(req);
 if(session)return 'web:'+session.u;
 const configured=process.env.CONTENT_OS_EDITORIAL_API_TOKEN;
 const value=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
 if(configured&&value&&Buffer.byteLength(configured)===Buffer.byteLength(value)&&crypto.timingSafeEqual(Buffer.from(configured),Buffer.from(value)))return 'integration';
 return null;
}
async function db(table,method='GET',body,query='',prefer='return=representation'){
 const key=KEY();if(!key)throw new Error('Database service credentials unavailable');
 const headers={'apikey':key,'Content-Type':'application/json','Prefer':prefer};
 if(!key.startsWith('sb_secret_'))headers.Authorization='Bearer '+key;
 const r=await fetch(BASE+'/rest/v1/'+table+(query?'?'+query:''),{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const raw=await r.text();
 if(!r.ok)throw new Error('Database '+r.status+': '+raw.slice(0,300));
 return raw?JSON.parse(raw):[];
}
function allowed(v){return v&&typeof v==='object'&&!Array.isArray(v)&&['competitor','plan'].includes(v.kind)&&typeof v.title==='string'&&v.title.trim().length>0&&v.title.length<=240&&JSON.stringify(v).length<25000}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Allow','GET, POST, PATCH');
 if(!['GET','POST','PATCH'].includes(req.method))return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
 let actor;try{actor=auth(req);}catch{return res.status(503).json({ok:false,error:'AUTH_NOT_CONFIGURED'});}
 if(!actor)return res.status(401).json({ok:false,error:'AUTH_REQUIRED'});
 try{
  if(req.method==='GET'){
   const [records,history]=await Promise.all([
    db('content_os_editorial_records','GET',undefined,'workspace_id=eq.'+WORKSPACE+'&select=*&order=updated_at.desc&limit=500'),
    db('content_os_editorial_history','GET',undefined,'workspace_id=eq.'+WORKSPACE+'&select=record_id,revision,event,actor,created_at&order=created_at.desc&limit=100')
   ]);
   return res.status(200).json({ok:true,records,history});
  }
  const input=req.body;
  if(!allowed(input))return res.status(400).json({ok:false,error:'INVALID_RECORD'});
  const id=input.id&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(input.id)?input.id:crypto.randomUUID();
  const existing=await db('content_os_editorial_records','GET',undefined,'id=eq.'+id+'&workspace_id=eq.'+WORKSPACE+'&select=*&limit=1');
  const previous=existing[0];
  if(req.method==='PATCH'&&!previous)return res.status(404).json({ok:false,error:'NOT_FOUND'});
  if(previous&&input.expectedRevision!==previous.revision)return res.status(409).json({ok:false,error:'REVISION_CONFLICT',currentRevision:previous.revision});
  const revision=(previous?.revision||0)+1;
  const payload={...input};delete payload.expectedRevision;delete payload.revision;
  const row={id,workspace_id:WORKSPACE,kind:input.kind,title:input.title.trim(),format:input.format||null,status:input.status||null,topic:input.topic||null,folder:input.folder||input.topic||null,scheduled_at:input.scheduledAt||null,payload,revision,updated_at:new Date().toISOString()};
  const saved=previous?await db('content_os_editorial_records','PATCH',row,'id=eq.'+id+'&workspace_id=eq.'+WORKSPACE):await db('content_os_editorial_records','POST',row);
  await db('content_os_editorial_history','POST',{record_id:id,workspace_id:WORKSPACE,revision,event:previous?'updated':'created',actor,snapshot:row});
  return res.status(previous?200:201).json({ok:true,record:saved[0]||row});
 }catch(error){console.error('Editorial API request failed:',error.message);return res.status(500).json({ok:false,error:'EDITORIAL_OPERATION_FAILED'});}
}