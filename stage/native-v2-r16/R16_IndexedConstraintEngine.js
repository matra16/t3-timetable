'use strict';
/**
 * T3TT R16 Indexed Constraint Engine — pure V8 JavaScript, no Google APIs.
 * Draft/synthetic only until owner authorizes server-side adapter.
 * Does not approve schedule, assign personnel or publish.
 */
const WEEKDAYS=['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์'];
const PROFILE=Object.freeze({'60MIN':60,'50MIN':50,'ACTIVITY15':15});
function safe(v){return typeof v==='string'&&v.trim().length>0&&!/^[=+@\t\r]/.test(v)&&!/[\u0000-\u001f]/.test(v)}
function dayOK(iso,day){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(iso||'')))return false;const d=new Date(iso+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso&&WEEKDAYS[(d.getUTCDay()+6)%7]===day}
function validateIndexed(events,teamLinks){
 if(!Array.isArray(events)||!Array.isArray(teamLinks))throw Error('ARRAYS_REQUIRED');
 if(events.length>5000||teamLinks.length>25000)throw Error('BOUNDED_INPUT_EXCEEDED');
 const issues=[],eventsById=new Map(),teachersByEvent=new Map(),groups=new Map();
 const add=(code,rec,other)=>issues.push({code,eventId:rec||'',otherEventId:other||''});
 for(const t of teamLinks){
  if(!t||!safe(t.eventId)||!safe(t.teacherId)||!['LEAD','CO'].includes(t.role)){add('TEAM_INVALID',t?.eventId);continue}
  let x=teachersByEvent.get(t.eventId);if(!x){x=[];teachersByEvent.set(t.eventId,x)}
  if(x.some(a=>a.teacherId===t.teacherId))add('TEAM_DUPLICATE',t.eventId);
  x.push(t);
 }
 const put=(kind,id,e)=>{
   const key=e.date+'|'+e.day+'|'+kind+'|'+id;
   let a=groups.get(key);if(!a){a=[];groups.set(key,a)}a.push(e)
 };
 for(const e of events){
  const id=e?.eventId;
  if(!e||!safe(id)||!safe(e.classGroupId)||!safe(e.courseId)||!dayOK(e.date,e.day)||!Number.isInteger(e.startMinute)||!Number.isInteger(e.endMinute)||!Object.hasOwn(PROFILE,e.timeProfile)||e.endMinute-e.startMinute!==PROFILE[e.timeProfile]||e.startMinute<0||e.endMinute>1440||!['DRAFT','CANCELLED'].includes(e.status)){add('EVENT_INVALID',id);continue}
  if(eventsById.has(id)){add('EVENT_DUPLICATE',id);continue}
  eventsById.set(id,e);
  if(e.status==='CANCELLED')continue;
  if(!safe(e.roomId))add('ROOM_UNVERIFIED',id);
  const links=teachersByEvent.get(id)||[];
  if(links.length<1||links.length>5||links.filter(x=>x.role==='LEAD').length!==1)add('TEAM_SIZE_OR_ROLE',id);
  put('CLASS',e.classGroupId,e);
  if(safe(e.roomId))put('ROOM',e.roomId,e);
  for(const tid of new Set(links.map(t=>t.teacherId)))put('TEACHER',tid,e);
 }
 for(const [id,links] of teachersByEvent)if(!eventsById.has(id))add('TEAM_ORPHAN',id);
 for(const [key,a] of groups){
  a.sort((x,y)=>x.startMinute-y.startMinute||x.endMinute-y.endMinute);
  const [,,kind]=key.split('|');
  for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length&&a[j].startMinute<a[i].endMinute;j++){
    if(a[i].eventId!==a[j].eventId)add(kind+'_TIME_CONFLICT',a[i].eventId,a[j].eventId)
  }
 }
 const dedupe=new Map;
 for(const x of issues){const k=x.code+'|'+[x.eventId,x.otherEventId].sort().join('|');if(!dedupe.has(k))dedupe.set(k,x)}
 return {issues:[...dedupe.values()],checked:{events:events.length,teachers:teamLinks.length,resourceGroups:groups.size},publishable:false};
}
module.exports={validateIndexed,WEEKDAYS,PROFILE};