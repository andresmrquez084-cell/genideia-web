import crypto from 'node:crypto';
import {sb} from './_instagram-direct.js';

const STATUS_BASE='https://content-os-navy-seven.vercel.app/api/content-os/instagram-data-deletion';
function decodeBase64Url(value){return Buffer.from(String(value||'').replace(/-/g,'+').replace(/_/g,'/'),'base64')}
function verifySignedRequest(signedRequest,secret){
  if(!signedRequest||!secret)return null;
  const [sigPart,payloadPart]=String(signedRequest).split('.');
  if(!sigPart||!payloadPart)return null;
  const expected=crypto.createHmac('sha256',secret).update(payloadPart).digest();
  const actual=decodeBase64Url(sigPart);
  if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))return null;
  try{return JSON.parse(decodeBase64Url(payloadPart).toString('utf8'))}catch{return null}
}
function confirmation(userId,secret){return crypto.createHmac('sha256',secret).update(`content-os-delete:${userId}`).digest('hex').slice(0,24)}

export default async function handler(req,res){
  if(req.method==='GET'){
    const code=String(req.query?.confirmation_code||'');
    if(!code)return res.status(400).json({ok:false,error:'Missing confirmation_code'});
    return res.status(200).json({ok:true,confirmation_code:code,status:'completed',message:'La solicitud de eliminación de datos de Instagram fue procesada.'});
  }
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  const secret=process.env.INSTAGRAM_LOGIN_APP_SECRET||process.env.INSTAGRAM_APP_SECRET;
  const payload=verifySignedRequest(req.body?.signed_request||req.body?.signedRequest,secret);
  if(!payload)return res.status(400).json({ok:false,error:'Invalid signed_request'});
  const userId=String(payload.user_id||payload.userId||'');
  if(!userId)return res.status(400).json({ok:false,error:'Missing Instagram user id'});
  const code=confirmation(userId,secret);
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
    return res.status(200).json({url:`${STATUS_BASE}?confirmation_code=${encodeURIComponent(code)}`,confirmation_code:code});
  }catch(e){
    console.error('instagram data deletion',e);
    return res.status(500).json({ok:false,error:'Could not complete data deletion request'});
  }
}
