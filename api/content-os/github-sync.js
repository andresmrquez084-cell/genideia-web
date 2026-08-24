import crypto from 'node:crypto';
import {sb,syncInstagramDirect} from './_instagram-direct.js';

const EXPECTED_ISSUER='https://token.actions.githubusercontent.com';
const EXPECTED_AUDIENCE='genideia-content-os-sync';
const EXPECTED_REPOSITORY='andresmrquez084-cell/genideia-web';
const EXPECTED_REF='refs/heads/main';
const WORKSPACE='f2a0c61f-160c-4300-aac6-dcb8c89d98d7';
let jwksCache={at:0,keys:[]};

function decodePart(value){return JSON.parse(Buffer.from(value,'base64url').toString('utf8'))}
async function jwks(){if(Date.now()-jwksCache.at<6*60*60*1000&&jwksCache.keys.length)return jwksCache.keys;const r=await fetch('https://token.actions.githubusercontent.com/.well-known/jwks');if(!r.ok)throw new Error(`GitHub JWKS ${r.status}`);const p=await r.json();jwksCache={at:Date.now(),keys:p.keys||[]};return jwksCache.keys}
function audienceMatches(aud){return Array.isArray(aud)?aud.includes(EXPECTED_AUDIENCE):aud===EXPECTED_AUDIENCE}
async function verifyGithubOidc(token){const parts=String(token||'').split('.');if(parts.length!==3)throw new Error('Invalid OIDC token');const header=decodePart(parts[0]),claims=decodePart(parts[1]);if(header.alg!=='RS256'||!header.kid)throw new Error('Unexpected OIDC signing algorithm');const now=Math.floor(Date.now()/1000);if(claims.iss!==EXPECTED_ISSUER)throw new Error('Invalid OIDC issuer');if(!audienceMatches(claims.aud))throw new Error('Invalid OIDC audience');if(Number(claims.exp||0)<=now)throw new Error('Expired OIDC token');if(claims.nbf&&Number(claims.nbf)>now+30)throw new Error('OIDC token not active');if(claims.repository!==EXPECTED_REPOSITORY)throw new Error('Unexpected repository');if(claims.ref!==EXPECTED_REF)throw new Error('Unexpected ref');const keys=await jwks();const jwk=keys.find(k=>k.kid===header.kid);if(!jwk)throw new Error('Unknown GitHub signing key');const publicKey=crypto.createPublicKey({key:jwk,format:'jwk'});const valid=crypto.verify('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),publicKey,Buffer.from(parts[2],'base64url'));if(!valid)throw new Error('Invalid OIDC signature');return claims}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST required'});
  try{
    const auth=String(req.headers.authorization||'');
    if(!auth.startsWith('Bearer '))return res.status(401).json({ok:false,error:'Missing GitHub OIDC token'});
    const claims=await verifyGithubOidc(auth.slice(7));
    const workspaceId=process.env.CONTENT_OS_WORKSPACE_ID||WORKSPACE;
    const recent=await sb(`content_os_sync_runs?workspace_id=eq.${encodeURIComponent(workspaceId)}&status=in.(completed,completed_with_errors)&select=finished_at&order=finished_at.desc&limit=1`);
    const last=recent?.[0]?.finished_at?new Date(recent[0].finished_at).getTime():0;
    if(last&&Date.now()-last<45*60*1000)return res.status(200).json({ok:true,skipped:true,reason:'fresh',lastSync:recent[0].finished_at,actor:claims.actor||null});
    const result=await syncInstagramDirect({workspaceId,limit:35,jobType:'instagram_hourly_sync'});
    return res.status(200).json({...result,automatic:true,scheduler:'github-actions',actor:claims.actor||null});
  }catch(e){console.error('github scheduled sync failed',e);return res.status(500).json({ok:false,error:e.message});}
}
