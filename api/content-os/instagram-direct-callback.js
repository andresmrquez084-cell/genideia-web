import crypto from 'node:crypto';
import {persistDirectConnection,sb,syncInstagramDirect} from './_instagram-direct.js';

const DEFAULT_APP_ID='1706003890504391';
const DEFAULT_WORKSPACE_ID='f2a0c61f-160c-4300-aac6-dcb8c89d98d7';
const DEFAULT_REDIRECT='https://content-os-navy-seven.vercel.app/api/content-os/instagram-direct-callback';
const SCOPES=['instagram_business_basic','instagram_business_manage_insights'];

function verifyState(state,secret){if(!state||!secret)return null;const [body,sig]=String(state).split('.');if(!body||!sig)return null;const expected=crypto.createHmac('sha256',secret).update(body).digest('base64url');const a=Buffer.from(sig),b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;const p=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));if(!p?.workspaceId||!p?.exp||Date.now()>p.exp)return null;return p}
function decodeBase64Url(value){return Buffer.from(String(value||'').replace(/-/g,'+').replace(/_/g,'/'),'base64')}
function verifyMetaSignedRequest(signedRequest,secret){if(!signedRequest||!secret)return null;const [sigPart,payloadPart]=String(signedRequest).split('.');if(!sigPart||!payloadPart)return null;const expected=crypto.createHmac('sha256',secret).update(payloadPart).digest();const actual=decodeBase64Url(sigPart);if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return null;try{return JSON.parse(decodeBase64Url(payloadPart).toString('utf8'))}catch{return null}}
function h(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function confirmation(userId,secret){return crypto.createHmac('sha256',secret).update(`content-os-delete:${userId}`).digest('hex').slice(0,24)}
async function fetchJson(url,options={}){const r=await fetch(url,options);const t=await r.text();let p={};try{p=t?JSON.parse(t):{}}catch{}if(!r.ok)throw new Error(p?.error_message||p?.error?.message||`HTTP ${r.status}: ${t}`);return p}
async function profile(token){for(const fields of ['id,user_id,username,account_type,media_count,followers_count,profile_picture_url','id,username,account_type,media_count,followers_count,profile_picture_url','id,username,account_type']){try{return await fetchJson(`https://graph.instagram.com/me?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`)}catch{}}throw new Error('No se pudo leer el perfil autorizado de Instagram')}

async function handleDeauthorize(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  const appSecret=process.env.INSTAGRAM_LOGIN_APP_SECRET||process.env.INSTAGRAM_APP_SECRET;
  const payload=verifyMetaSignedRequest(req.body?.signed_request||req.body?.signedRequest,appSecret);
  if(!payload)return res.status(400).json({ok:false,error:'Invalid signed_request'});
  const userId=String(payload.user_id||payload.userId||'');
  try{
    if(userId){
      await sb(`content_os_connections?platform=eq.instagram&external_identity_id=eq.${encodeURIComponent(userId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'disconnected',updated_at:new Date().toISOString()})});
      await sb(`content_os_accounts?platform=eq.instagram&external_account_id=eq.${encodeURIComponent(userId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'disconnected'})}).catch(()=>{});
    }
    return res.status(200).json({ok:true});
  }catch(e){console.error('instagram deauthorize',e);return res.status(500).json({ok:false,error:'Could not deauthorize connection'})}
}

async function handleDataDeletion(req,res){
  const appSecret=process.env.INSTAGRAM_LOGIN_APP_SECRET||process.env.INSTAGRAM_APP_SECRET;
  if(req.method==='GET'){
    const code=String(req.query?.confirmation_code||'');
    if(!code)return res.status(400).json({ok:false,error:'Missing confirmation_code'});
    return res.status(200).json({ok:true,confirmation_code:code,status:'completed',message:'La solicitud de eliminación de datos de Instagram fue procesada.'});
  }
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  const payload=verifyMetaSignedRequest(req.body?.signed_request||req.body?.signedRequest,appSecret);
  if(!payload)return res.status(400).json({ok:false,error:'Invalid signed_request'});
  const userId=String(payload.user_id||payload.userId||'');
  if(!userId)return res.status(400).json({ok:false,error:'Missing Instagram user id'});
  const code=confirmation(userId,appSecret);
  try{
    const accounts=await sb(`content_os_accounts?platform=eq.instagram&external_account_id=eq.${encodeURIComponent(userId)}&select=id`);
    for(const account of accounts||[]){
      const id=account.id;
      await sb(`content_os_account_snapshots?account_id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}).catch(()=>{});
      await sb(`content_os_sync_runs?account_id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}).catch(()=>{});
      await sb(`content_os_content?account_id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}).catch(()=>{});
      await sb(`content_os_accounts?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}).catch(()=>{});
    }
    await sb(`content_os_connections?platform=eq.instagram&external_identity_id=eq.${encodeURIComponent(userId)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}}).catch(()=>{});
    const statusUrl=`${DEFAULT_REDIRECT}?meta_action=data_deletion&confirmation_code=${encodeURIComponent(code)}`;
    return res.status(200).json({url:statusUrl,confirmation_code:code});
  }catch(e){console.error('instagram data deletion',e);return res.status(500).json({ok:false,error:'Could not complete data deletion request'})}
}

export default async function handler(req,res){
  const metaAction=String(req.query?.meta_action||'');
  if(metaAction==='deauthorize')return handleDeauthorize(req,res);
  if(metaAction==='data_deletion')return handleDataDeletion(req,res);
  if(req.query?.error){res.status(400).setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#07101f;color:white"><h1>Instagram no se conectó</h1><p>${h(req.query.error_description||req.query.error)}</p></body></html>`)}
  const code=req.query?.code;if(!code)return res.status(400).json({error:'Missing code'});
  const state=verifyState(req.query?.state,process.env.CONTENT_OS_SYNC_SECRET);if(!state)return res.status(400).json({error:'Invalid or expired state'});
  const appId=process.env.INSTAGRAM_LOGIN_APP_ID||DEFAULT_APP_ID;
  const appSecret=process.env.INSTAGRAM_LOGIN_APP_SECRET||process.env.INSTAGRAM_APP_SECRET;
  const redirectUri=process.env.INSTAGRAM_LOGIN_REDIRECT_URI||DEFAULT_REDIRECT;
  if(!appSecret){res.status(503).setHeader('Content-Type','text/html; charset=utf-8');return res.end('<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#07101f;color:white"><h1>Falta una configuración</h1><p>Instagram autorizó la cuenta, pero falta configurar el App Secret del producto Instagram Login en Vercel.</p></body></html>')}
  try{
    const form=new URLSearchParams({client_id:appId,client_secret:appSecret,grant_type:'authorization_code',redirect_uri:redirectUri,code:String(code)});
    const short=await fetchJson('https://api.instagram.com/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});
    let accessToken=short.access_token;let expiresIn=Number(short.expires_in||0);
    if(!accessToken)throw new Error('Instagram no devolvió un access token');
    try{const u=new URL('https://graph.instagram.com/access_token');u.searchParams.set('grant_type','ig_exchange_token');u.searchParams.set('client_secret',appSecret);u.searchParams.set('access_token',accessToken);const long=await fetchJson(u);if(long.access_token){accessToken=long.access_token;expiresIn=Number(long.expires_in||expiresIn)}}catch(e){console.warn('long lived token exchange unavailable',e.message)}
    const p=await profile(accessToken);const externalId=String(p.user_id||p.id||short.user_id);
    await persistDirectConnection({workspaceId:state.workspaceId||DEFAULT_WORKSPACE_ID,externalIdentityId:externalId,externalIdentityName:p.username||'Instagram',accessToken,tokenExpiresAt:expiresIn?new Date(Date.now()+expiresIn*1000).toISOString():null,scopes:SCOPES});
    await sb('content_os_accounts?on_conflict=workspace_id,platform,external_account_id',{method:'POST',headers:{Prefer:'return=minimal,resolution=merge-duplicates'},body:JSON.stringify([{workspace_id:state.workspaceId,platform:'instagram',external_account_id:externalId,username:p.username||null,account_type:p.account_type||null,avatar_url:p.profile_picture_url||null,status:'connected',permissions:SCOPES,last_synced_at:new Date().toISOString(),raw_profile:p}])});
    let syncResult=null;try{syncResult=await syncInstagramDirect({workspaceId:state.workspaceId,limit:50,jobType:'instagram_connection_sync'})}catch(e){console.warn('post connect sync failed',e.message)}
    res.status(200).setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<!doctype html><html><head><meta http-equiv="refresh" content="2;url=/content-os?instagram=connected"></head><body style="font-family:system-ui;padding:32px;background:#07101f;color:white"><h1>Instagram conectado</h1><p><strong>@${h(p.username||externalId)}</strong> quedó autorizado para sincronización automática.</p><p>${syncResult?`${syncResult.snapshots} snapshots guardados en esta sincronización.`:'La conexión quedó guardada; el sincronizador automático continuará desde aquí.'}</p><p>Volviendo a Content OS…</p></body></html>`)
  }catch(e){console.error('instagram direct callback',e);res.status(500).setHeader('Content-Type','text/html; charset=utf-8');return res.end(`<!doctype html><html><body style="font-family:system-ui;padding:32px;background:#07101f;color:white"><h1>No se pudo completar la conexión</h1><p>${h(e.message)}</p></body></html>`)}
}
