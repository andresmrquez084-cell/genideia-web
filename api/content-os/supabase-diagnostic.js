const DEFAULT_SUPABASE_URL='https://dbwuubabafzsinaokawe.supabase.co';
export default async function handler(req,res){
  const url=process.env.CONTENT_OS_SUPABASE_URL||DEFAULT_SUPABASE_URL;
  const key=process.env.CONTENT_OS_SUPABASE_SECRET_KEY||process.env.CONTENT_OS_SUPABASE_SERVICE_ROLE_KEY||'';
  if(!key)return res.status(500).json({ok:false,error:'missing key',url});
  const headers={apikey:key,Accept:'application/openapi+json'};
  if(!key.startsWith('sb_secret_'))headers.Authorization=`Bearer ${key}`;
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
    return res.status(200).json({ok:r.ok,status:r.status,url,keyType:key.startsWith('sb_secret_')?'sb_secret':'legacy',schemaTitle:title,schemaDescription:description,contentOsPaths:paths,bodyPreview:r.ok?undefined:text.slice(0,300)});
  }catch(e){return res.status(500).json({ok:false,error:e.message,url});}
}
