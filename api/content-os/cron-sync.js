import {sb,syncInstagramDirect} from './_instagram-direct.js';

const WORKSPACE='f2a0c61f-160c-4300-aac6-dcb8c89d98d7';
const SCHEDULE='0 * * * *';

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'GET required'});
  const cronSecret=process.env.CRON_SECRET;
  const auth=req.headers.authorization;
  const schedule=req.headers['x-vercel-cron-schedule'];
  if(cronSecret){if(auth!==`Bearer ${cronSecret}`)return res.status(401).json({ok:false,error:'Unauthorized'});}else if(schedule!==SCHEDULE){return res.status(401).json({ok:false,error:'Cron request required'});}
  const workspaceId=process.env.CONTENT_OS_WORKSPACE_ID||WORKSPACE;
  try{
    const recent=await sb(`content_os_sync_runs?workspace_id=eq.${encodeURIComponent(workspaceId)}&status=in.(completed,completed_with_errors)&select=finished_at&order=finished_at.desc&limit=1`);
    const last=recent?.[0]?.finished_at?new Date(recent[0].finished_at).getTime():0;
    if(last&&Date.now()-last<45*60*1000)return res.status(200).json({ok:true,skipped:true,reason:'fresh',lastSync:recent[0].finished_at});
    const result=await syncInstagramDirect({workspaceId,limit:35,jobType:'instagram_hourly_sync'});
    return res.status(200).json({...result,automatic:true});
  }catch(e){console.error('cron sync failed',e);return res.status(500).json({ok:false,error:e.message});}
}
