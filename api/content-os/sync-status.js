import {sb} from './_instagram-direct.js';

const WORKSPACE='f2a0c61f-160c-4300-aac6-dcb8c89d98d7';
export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'GET required'});
  res.setHeader('Cache-Control','no-store, max-age=0');
  const workspaceId=process.env.CONTENT_OS_WORKSPACE_ID||WORKSPACE;
  try{
    const [connections,accounts,runs]=await Promise.all([
      sb(`content_os_connections?workspace_id=eq.${encodeURIComponent(workspaceId)}&platform=eq.instagram&connection_type=eq.instagram_login_direct&select=id,external_identity_name,token_expires_at,status,last_validated_at,updated_at&order=updated_at.desc&limit=1`),
      sb(`content_os_accounts?workspace_id=eq.${encodeURIComponent(workspaceId)}&platform=eq.instagram&select=id,username,status,last_synced_at&order=updated_at.desc&limit=1`),
      sb(`content_os_sync_runs?workspace_id=eq.${encodeURIComponent(workspaceId)}&select=id,job_type,status,started_at,finished_at,imported_count,snapshot_count,error_count,error_message&order=started_at.desc&limit=5`)
    ]);
    const connection=connections?.[0]||null,account=accounts?.[0]||null,lastRun=runs?.[0]||null;
    const lastSync=lastRun?.finished_at||account?.last_synced_at||null;
    const ageMinutes=lastSync?Math.max(0,Math.round((Date.now()-new Date(lastSync).getTime())/60000)):null;
    const connected=Boolean(connection&&connection.status==='connected');
    let freshness='not_connected';
    if(connected&&ageMinutes!==null)freshness=ageMinutes<=90?'fresh':ageMinutes<=360?'delayed':'stale';
    else if(connected)freshness='waiting_first_sync';
    return res.status(200).json({ok:true,connected,freshness,ageMinutes,lastSync,account:account?.username||connection?.external_identity_name||null,tokenExpiresAt:connection?.token_expires_at||null,lastRun,runs,automatic:{enabled:connected,schedule:'hourly',scheduleLabel:'Cada hora'},connectUrl:'/api/content-os/connect-instagram-direct'});
  }catch(e){return res.status(500).json({ok:false,error:e.message});}
}
