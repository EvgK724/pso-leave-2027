import webpush from 'npm:web-push@3.6.7';
import {applyCommand,calendarICS,initialState,PEOPLE,todayYekaterinburg} from '../_shared/engine.js';
const APP='https://evgk724.github.io/pso-leave-2027/';
const ORIGIN=new URL(APP).origin;
const base=Deno.env.get('SUPABASE_URL')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default;
async function db(path:string,method='GET',body?:unknown,extra={}){
 const res=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'return=representation',...extra},body:body===undefined?undefined:JSON.stringify(body)});
 const text=await res.text();if(!res.ok)throw new Error('Database operation failed: '+res.status);return text?JSON.parse(text):null;
}
const encoded=(s:string)=>encodeURIComponent(s);
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
async function getState(){let rows=await db('leave2027_state?id=eq.1');if(!rows.length){await db('leave2027_state','POST',{id:1,version:0,state:initialState()},{Prefer:'resolution=ignore-duplicates,return=representation'});rows=await db('leave2027_state?id=eq.1');}return rows[0].state;}
async function setting(key:string){return (await db('leave2027_settings?key=eq.'+encoded(key)))[0]?.value;}
async function vapid(){let key=await setting('vapid');if(!key){const generated=webpush.generateVAPIDKeys();await db('leave2027_settings','POST',{key:'vapid',value:generated},{Prefer:'resolution=ignore-duplicates,return=representation'});key=await setting('vapid');}return key;}
async function authenticate(token:string,kind='access'){
 if(!/^[a-f0-9]{64}$/.test(token))return null;
 const rows=await db('leave2027_access?token=eq.'+encoded(token)+'&kind=eq.'+kind+'&select=doctor_id');return rows[0]?.doctor_id||null;
}
function visible(state:any,actor:string){const copy=structuredClone(state);copy.events=copy.events.filter((e:any)=>e.to.includes(actor));return copy;}
function goodPush(s:any){try{const u=new URL(s.endpoint);return u.protocol==='https:'&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='wns2-par02p.notify.windows.com'||u.hostname.endsWith('.notify.windows.com'))&&/^[A-Za-z0-9_-]{80,100}$/.test(s.keys.p256dh)&&/^[A-Za-z0-9_-]{20,30}$/.test(s.keys.auth);}catch{return false;}}
async function flush(){
 const config=await vapid();const jobs=await db('leave2027_outbox?sent_at=is.null&attempts=lt.5&order=created_at.asc&limit=50');let sent=0;
 for(const job of jobs){
  const state=await getState(),d=state.doctors.find((d:any)=>d.id===job.doctor_id);
  if(job.payload.type==='reminder'&&(d?.submitted||todayYekaterinburg()>'2026-10-31')){await db('leave2027_outbox?id=eq.'+encoded(job.id),'PATCH',{sent_at:new Date().toISOString(),last_error:'Reminder no longer needed'});continue;}
  const subs=await db('leave2027_push?doctor_id=eq.'+job.doctor_id);let failed=false;
  for(const sub of subs){try{
   const body=JSON.stringify({title:'Отпуск 2027 · ПСО',body:job.payload.text,tag:job.payload.id,badge:1,url:APP+(job.doctor_id==='klepikov'?'#eyu':'#home')});
   const request=webpush.generateRequestDetails(sub.subscription,body,{vapidDetails:{subject:APP,publicKey:config.publicKey,privateKey:config.privateKey},TTL:86400,urgency:'normal'});
   const response=await fetch(request.endpoint,{method:'POST',headers:request.headers,body:request.body,redirect:'error',signal:AbortSignal.timeout(12000)});
   if([404,410].includes(response.status))await db('leave2027_push?endpoint=eq.'+encoded(sub.endpoint),'DELETE');
   else if(!response.ok)throw new Error('Push status '+response.status);else sent++;
  }catch{failed=true;}}
  await db('leave2027_outbox?id=eq.'+encoded(job.id),'PATCH',{sent_at:failed?null:new Date().toISOString(),attempts:job.attempts+1,last_error:failed?'Push delivery failed':null});
 }
 return sent;
}
// Serializes local flushes; durable outbox survives isolate shutdown.
let flushing:Promise<any>|null=null;
function queueFlush(){if(!flushing)flushing=flush().catch(()=>{}).finally(()=>{flushing=null;});(globalThis as any).EdgeRuntime?.waitUntil(flushing);return flushing;}
Deno.serve(async req=>{
 const origin=req.headers.get('Origin');
 const cors={'Access-Control-Allow-Origin':ORIGIN,'Vary':'Origin','Access-Control-Allow-Headers':'Content-Type,X-Leave-Access','Access-Control-Allow-Methods':'POST,GET,OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 const json=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json;charset=utf-8'}});
 if(origin&&origin!==ORIGIN)return json({error:'Origin not allowed'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 try{
  const url=new URL(req.url);
  if(req.method==='GET'&&url.searchParams.has('calendar')){
   const actor=await authenticate(url.searchParams.get('calendar')!,'calendar');if(!actor)return json({error:'Calendar link invalid'},401);
   return new Response(calendarICS(await getState(),actor),{headers:{...cors,'Content-Type':'text/calendar;charset=utf-8','Content-Disposition':'inline; filename="vacation-2027.ics"'}});
  }
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  if(Number(req.headers.get('Content-Length'))>20000)return json({error:'Request too large'},413);
  const raw=await req.text();if(raw.length>20000)return json({error:'Request too large'},413);
  const input=JSON.parse(raw);
  if(['cron','flush'].includes(input.action)){
   const key=await setting('cron_key');if(!key||input.key!==key)return json({error:'Unauthorized'},401);
   const count=input.action==='cron'?await db('rpc/leave2027_reminders','POST',{}):0;const sent=await queueFlush();return json({reminders:count,push:sent});
  }
  const actor=await authenticate(req.headers.get('X-Leave-Access')||'');if(!actor)return json({error:'Персональная ссылка недействительна.'},401);
  if(input.action==='state')return json({actor,state:visible(await getState(),actor)});
  if(input.action==='command'){
   const current=await getState();if(input.version!==current.version)return json({error:'Данные изменились. Обновите график.'},409);
   const next=applyCommand(current,actor,input.command);
   const committed=await db('rpc/leave2027_commit','POST',{p_expected:current.version,p_state:next});
   if(!committed)return json({error:'Другой врач уже изменил график. Обновите даты.'},409);
   queueFlush();return json({state:visible(next,actor)});
  }
  if(input.action==='invites'){
   if(actor!=='klepikov')return json({error:'Ссылки доступны только ЕЮ.'},403);
   const rows=await db('leave2027_access?kind=eq.access');return json({invites:rows.map((r:any)=>({name:PEOPLE.find((p:any)=>p[0]===r.doctor_id)?.[1],token:r.token}))});
  }
  if(input.action==='calendar-key'){
   let rows=await db('leave2027_access?doctor_id=eq.'+actor+'&kind=eq.calendar');
   if(!rows.length){await db('leave2027_access','POST',{doctor_id:actor,kind:'calendar',token:random()},{Prefer:'resolution=ignore-duplicates,return=representation'});rows=await db('leave2027_access?doctor_id=eq.'+actor+'&kind=eq.calendar');}
   return json({key:rows[0].token});
  }
  if(input.action==='push-config')return json({publicKey:(await vapid()).publicKey});
  if(input.action==='subscribe'){
   if(!goodPush(input.subscription))return json({error:'Неверная подписка телефона.'},400);
   const endpoint=input.subscription.endpoint,own=await db('leave2027_push?endpoint=eq.'+encoded(endpoint));
   if(own.length&&own[0].doctor_id!==actor)return json({error:'Сначала отключите уведомления предыдущего профиля на этом телефоне.'},409);
   await db('leave2027_push','POST',{endpoint,doctor_id:actor,subscription:input.subscription},{Prefer:'resolution=merge-duplicates,return=representation'});return json({subscribed:true});
  }
  if(input.action==='unsubscribe'){await db('leave2027_push?doctor_id=eq.'+actor+'&endpoint=eq.'+encoded(input.endpoint),'DELETE');return json({subscribed:false});}
  return json({error:'Unknown action'},400);
 }catch(e){const message=e instanceof Error?e.message:'Request failed';return json({error:message.startsWith('Database')?'Сервер временно недоступен. Попробуйте ещё раз.':message},400);}
});
