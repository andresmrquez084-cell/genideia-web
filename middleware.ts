import { next } from '@vercel/functions';

const COOKIE = 'genideia_academy';
const LOGIN_PATH = '/academy/acceso';
const SESSION_DAYS = 30;

type AcademyUser = { password: string; role: 'admin' | 'student'; slug?: string };
type Session = { u: string; role: 'admin' | 'student'; slug?: string; exp: number };

function users(): Record<string, AcademyUser> {
  try { return JSON.parse(process.env.ACADEMY_USERS_JSON || '{}'); }
  catch { return {}; }
}
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
async function makeSession(u:string,user:AcademyUser){
  const payload:Session={u,role:user.role,slug:user.slug,exp:Date.now()+SESSION_DAYS*86400000};
  const body=enc(new TextEncoder().encode(JSON.stringify(payload)));
  return body+'.'+await hmac(body);
}
async function readSession(req:Request):Promise<Session|null>{
  const c=req.headers.get('cookie')||'';
  const hit=c.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='));
  if(!hit||!secret()) return null;
  const token=hit.slice(COOKIE.length+1);
  const [body,sig]=token.split('.');
  if(!body||!sig||await hmac(body)!==sig) return null;
  try{
    const data=JSON.parse(new TextDecoder().decode(dec(body))) as Session;
    if(!data.exp||data.exp<Date.now()) return null;
    return data;
  }catch{return null}
}
function redirect(url:string, cookie?:string){
  const headers=new Headers({Location:url,'Cache-Control':'no-store'});
  if(cookie) headers.append('Set-Cookie',cookie);
  return new Response(null,{status:303,headers});
}
function cookie(token:string){
  return `${COOKIE}=${token}; Path=/; Domain=.genideiacompany.com; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS*86400}`;
}
function clearCookie(){
  return `${COOKIE}=; Path=/; Domain=.genideiacompany.com; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export const config = { matcher: '/((?!_astro/|favicon\\.(?:ico|png|svg)|apple-touch-icon\\.png).*)' };

export default async function middleware(request: Request) {
  const url=new URL(request.url);
  const host=(request.headers.get('host')||url.host).split(':')[0];
  const path=url.pathname;
  const session=await readSession(request);

  if(path==='/academy/logout'){
    return redirect('https://genideiacompany.com/academy/acceso',clearCookie());
  }

  if(host==='genideiacompany.com' && path===LOGIN_PATH && request.method==='POST'){
    const form=await request.formData();
    const username=String(form.get('username')||'').trim().toLowerCase();
    const password=String(form.get('password')||'');
    const user=users()[username];
    if(!user||user.password!==password){
      return redirect('https://genideiacompany.com/academy/acceso?error=1');
    }
    const token=await makeSession(username,user);
    const dest=user.role==='admin'
      ? 'https://academy.genideiacompany.com'
      : `https://genideiacompany.com/academy/alumnos/${user.slug}`;
    return redirect(dest,cookie(token));
  }

  if(host==='genideiacompany.com' && path===LOGIN_PATH && session){
    const dest=session.role==='admin'
      ? 'https://academy.genideiacompany.com'
      : `https://genideiacompany.com/academy/alumnos/${session.slug}`;
    return redirect(dest);
  }

  if(host==='academy.genideiacompany.com'){
    if(!session||session.role!=='admin'){
      return redirect('https://genideiacompany.com/academy/acceso?next=panel');
    }
    return next({headers:{'Cache-Control':'private, no-store'}});
  }

  if(host==='genideiacompany.com' && path.startsWith('/academy/alumnos')){
    if(!session) return redirect('https://genideiacompany.com/academy/acceso');
    if(session.role==='admin') return next({headers:{'Cache-Control':'private, no-store'}});
    const wanted=path.split('/')[3]||'';
    if(!session.slug||wanted!==session.slug){
      return redirect(`https://genideiacompany.com/academy/alumnos/${session.slug}`);
    }
    return next({headers:{'Cache-Control':'private, no-store'}});
  }

  return next();
}
