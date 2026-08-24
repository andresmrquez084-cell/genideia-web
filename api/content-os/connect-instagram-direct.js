import crypto from 'node:crypto';

const DEFAULT_APP_ID='1706003890504391';
const DEFAULT_WORKSPACE_ID='f2a0c61f-160c-4300-aac6-dcb8c89d98d7';
const DEFAULT_REDIRECT='https://content-os-navy-seven.vercel.app/api/content-os/instagram-direct-callback';

function signState(payload,secret){const body=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',secret).update(body).digest('base64url');return `${body}.${sig}`}

export default async function handler(req,res){
  const secret=process.env.CONTENT_OS_SYNC_SECRET;
  if(!secret)return res.status(503).json({error:'Missing CONTENT_OS_SYNC_SECRET'});
  const workspaceId=String(req.query?.workspace_id||process.env.CONTENT_OS_WORKSPACE_ID||DEFAULT_WORKSPACE_ID);
  const appId=process.env.INSTAGRAM_LOGIN_APP_ID||DEFAULT_APP_ID;
  const redirectUri=process.env.INSTAGRAM_LOGIN_REDIRECT_URI||DEFAULT_REDIRECT;
  const state=signState({workspaceId,exp:Date.now()+10*60*1000},secret);
  const url=new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id',appId);
  url.searchParams.set('redirect_uri',redirectUri);
  url.searchParams.set('response_type','code');
  url.searchParams.set('scope','instagram_business_basic,instagram_business_manage_insights');
  url.searchParams.set('state',state);
  url.searchParams.set('enable_fb_login','0');
  url.searchParams.set('force_authentication','1');
  res.statusCode=302;res.setHeader('Location',url.toString());res.setHeader('Cache-Control','no-store');return res.end();
}
