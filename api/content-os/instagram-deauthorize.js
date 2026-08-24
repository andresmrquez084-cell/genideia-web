import crypto from 'node:crypto';
import {sb} from './_instagram-direct.js';

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

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  const secret=process.env.INSTAGRAM_LOGIN_APP_SECRET||process.env.INSTAGRAM_APP_SECRET;
  const payload=verifySignedRequest(req.body?.signed_request||req.body?.signedRequest,secret);
  if(!payload)return res.status(400).json({ok:false,error:'Invalid signed_request'});
  const userId=String(payload.user_id||payload.userId||'');
  try{
    if(userId){
      await sb(`content_os_connections?platform=eq.instagram&external_identity_id=eq.${encodeURIComponent(userId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'disconnected',updated_at:new Date().toISOString()})});
      await sb(`content_os_accounts?platform=eq.instagram&external_account_id=eq.${encodeURIComponent(userId)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'disconnected'})}).catch(()=>{});
    }
    return res.status(200).json({ok:true});
  }catch(e){
    console.error('instagram deauthorize',e);
    return res.status(500).json({ok:false,error:'Could not deauthorize connection'});
  }
}
