import { next } from '@vercel/functions';

const COOKIE = 'genideia_academy';

function secret() { return process.env.ACADEMY_SESSION_SECRET || ''; }
function enc(bytes: Uint8Array) {
  let s=''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function dec(s: string) {
  s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='=';
  const raw=atob(s); return Uint8Array.from(raw, c=>c.charCodeAt(0));
}
async function hmac(data: string) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret()),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return enc(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data))));
}
async function readSession(req:Request){
  const c=req.headers.get('cookie')||'';
  const hit=c.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
  if(!hit||!secret()) return null;
  const token=hit.slice(COOKIE.length+1);
  const [body,sig]=token.split('.');
  if(!body||!sig||await hmac(body)!==sig) return null;
  try{
    const data=JSON.parse(new TextDecoder().decode(dec(body)));
    if(!data.exp||data.exp<Date.now()) return null;
    return data;
  }catch{return null}
}

export const config = { matcher: '/((?!assets/|favicon\\.(?:ico|png|svg)).*)' };

export default async function middleware(request: Request) {
  const session=await readSession(request);
  if(!session || session.role!=='admin'){
    return new Response(null,{
      status:303,
      headers:{
        Location:'https://genideiacompany.com/academy/acceso?next=panel',
        'Cache-Control':'no-store'
      }
    });
  }
  return next({headers:{'Cache-Control':'private, no-store'}});
}
