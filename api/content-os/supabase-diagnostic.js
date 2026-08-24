const DEFAULT_SUPABASE_URL='https://dbwuubabafzsinaokawe.supabase.co';

function keyType(key){
  if(key.startsWith('sb_secret_'))return 'sb_secret';
  if(key.startsWith('sb_publishable_'))return 'sb_publishable';
  if(key.startsWith('eyJ'))return 'legacy_jwt';
  return 'unknown';
}

export default async function handler(req,res){
  const url=(process.env.CONTENT_OS_SUPABASE_URL||DEFAULT_SUPABASE_URL).trim();
  const rawKey=process.env.CONTENT_OS_SUPABASE_SECRET_KEY||process.env.CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY||'';
  const key=rawKey.trim();
  if(!key)return res.status(500).json({ok:false,error:'missing key',url});
  const type=keyType(key);
  const headers={apikey:key,Accept:'application/openapi+json'};
  if(type==='legacy_jwt')headers.Authorization=`Bearer ${key}`;
  try{
    const r=await fetch(`${url}/rest/v1/`,{headers});
    const text=await r.text();
    let paths=[];
    let title=null;
    let description=null;
    try{
      const data=JSON.parse(text);
      paths=Object.keys(data.paths||{}).filter(p=>p.includes('content_os')).sort();
      title=data.info?.title||null;description=data.info?.description||null;
    }catch{}
    return res.status(200).json({ok:r.ok,status:r.status,url,keyType:type,schemaTitle:title,schemaDescription:description,contentOsPaths:paths,bodyPreview:r.ok?undefined:text.slice(0,300)});
  }catch(e){return res.status(500).json({ok:false,error:e.message,url,keyType:type});}
}
