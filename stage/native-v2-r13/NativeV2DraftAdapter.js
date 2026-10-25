'use strict';
// Isolated stage adapter. No Google/Apps Script/network operations.
const DAYS=['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์'];
const STARTS=[510,570,630,750,810,870];
const VISIBLE=['หน้าหลัก','คู่มือใช้งาน(สำคัญ)','ข้อมูลครูผู้สอนและชั้นเรียน','ข้อมูลรายวิชา','วิชาคงเหลือ',...DAYS.map(x=>'ลงตารางวัน'+x),'ตารางเรียนรายชั้นเรียน','ตารางสอนครูผู้สอน','ตารางการใช้ห้องเรียน'];
const VALID_DURATION=Object.freeze({'60MIN':60,'50MIN':50,'ACTIVITY15':15});
const bad=s=>typeof s!=='string'||!s.trim()||/^[=+@\t\r]/.test(s)||/[\u0000-\u001f]/.test(s);
const fail=(code)=>{const e=new Error(code);e.code=code;throw e};
const dateOK=(ymd,day)=>{if(typeof ymd!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(ymd))return false;const date=new Date(ymd+'T00:00:00Z');return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===ymd&&DAYS[(date.getUTCDay()+6)%7]===day;};
function shadow(classIds){
 if(!Array.isArray(classIds)||classIds.length!==16||new Set(classIds).size!==16||classIds.some(bad)) fail('INVALID_CLASSES');
 const rows=[];DAYS.forEach((day,d)=>classIds.forEach((klass,c)=>STARTS.forEach((start,p)=>rows.push({slotId:'D'+(d+1)+'C'+(c+1)+'P'+(p+1),day,classGroupId:klass,startMinute:start,endMinute:start+60,authority:'UNVERIFIED_SHADOW',approved:false}))));
 return rows;
}
function compareVisible(before,after){
 if(!before||!after)fail('UI_SNAPSHOT_MISSING');
 for(const tab of VISIBLE){
  const a=before[tab],b=after[tab];
  if(!a||!b||typeof a.metadataDigest!=='string'||typeof a.boundedCellDigest!=='string'||a.metadataDigest!==b.metadataDigest||a.boundedCellDigest!==b.boundedCellDigest)fail('VISIBLE_UI_DRIFT:'+tab);
 }
 return true;
}
function overlap(a,b){return a.startMinute<b.endMinute&&b.startMinute<a.endMinute}
function validate(events,assignments){
 if(!Array.isArray(events)||!Array.isArray(assignments))fail('DATA_ARRAY_REQUIRED');
 const issues=[],seen=new Set(),teacherPerEvent=new Map();
 for(const a of assignments){
  if(!a||bad(a.eventId)||bad(a.teacherId)||!['LEAD','CO'].includes(a.role))issues.push({type:'TEAM_INVALID',eventId:a?.eventId||''});
  else {const k=a.eventId+'|'+a.teacherId;if(seen.has('T|'+k))issues.push({type:'TEAM_DUPLICATE',eventId:a.eventId});seen.add('T|'+k);let arr=teacherPerEvent.get(a.eventId)||[];arr.push(a);teacherPerEvent.set(a.eventId,arr)}
 }
 const eSeen=new Set();
 for(const ev of events){
  if(!ev||bad(ev.eventId)||bad(ev.classGroupId)||bad(ev.courseId)||bad(ev.day)||bad(ev.date)||!dateOK(ev.date,ev.day)||!DAYS.includes(ev.day)||!Number.isInteger(ev.startMinute)||!Number.isInteger(ev.endMinute)||!Object.hasOwn(VALID_DURATION,ev.timeProfile)||ev.endMinute-ev.startMinute!==VALID_DURATION[ev.timeProfile]||ev.startMinute<0||ev.endMinute>1440||!['DRAFT','CANCELLED'].includes(ev.status))issues.push({type:'EVENT_INVALID',eventId:ev?.eventId||''});
  else if(eSeen.has(ev.eventId))issues.push({type:'EVENT_DUPLICATE',eventId:ev.eventId});
  if(ev?.eventId)eSeen.add(ev.eventId);
  if(ev?.status==='DRAFT'&&bad(ev.roomId))issues.push({type:'ROOM_UNVERIFIED',eventId:ev.eventId});
  const team=teacherPerEvent.get(ev?.eventId)||[];
  if(ev?.status!=='CANCELLED'&&(team.length<1||team.length>5||team.filter(a=>a.role==='LEAD').length!==1))issues.push({type:'TEAM_SIZE_OR_LEAD',eventId:ev?.eventId||''});
 }
 for(const a of assignments)if(a?.eventId&&!eSeen.has(a.eventId))issues.push({type:'ORPHAN_TEAM',eventId:a.eventId});
 for(let i=0;i<events.length;i++)for(let j=i+1;j<events.length;j++){
  const a=events[i],b=events[j];if(!a||!b||a.status==='CANCELLED'||b.status==='CANCELLED'||a.date!==b.date||a.day!==b.day||!overlap(a,b))continue;
  if(a.classGroupId&&a.classGroupId===b.classGroupId)issues.push({type:'CLASS_OVERLAP',eventId:a.eventId,other:b.eventId});
  if(a.roomId&&b.roomId&&a.roomId===b.roomId)issues.push({type:'ROOM_OVERLAP',eventId:a.eventId,other:b.eventId});
  const ta=new Set((teacherPerEvent.get(a.eventId)||[]).map(t=>t.teacherId));if((teacherPerEvent.get(b.eventId)||[]).some(t=>ta.has(t.teacherId)))issues.push({type:'TEACHER_OVERLAP',eventId:a.eventId,other:b.eventId});
 }
 return issues;
}
function draftPlan(arg){
 if(!arg||bad(arg.spreadsheetId)||arg.spreadsheetId!==arg.expectedSpreadsheetId)fail('WRONG_DRAFT');
 if(!Number.isInteger(arg.baseRevision)||arg.baseRevision<0||arg.baseRevision!==arg.observedRevision)fail('STALE_REVISION');
 compareVisible(arg.visibleBefore,arg.visibleAfter);
 if(!Array.isArray(arg.events)||!Array.isArray(arg.assignments))fail('MISSING_EVENTS');
 if(arg.events.some(e=>e?.sourceStatus==='UNVERIFIED_SHADOW'))fail('UNVERIFIED_SOURCE_PROMOTION');
 const issues=validate(arg.events,arg.assignments);
 return {status:issues.length?'BLOCKED':'DRAFT_PLAN_ONLY',releaseAuthorized:false,deployAuthorized:false,target:'HIDDEN_TABS_ONLY',baseRevision:arg.baseRevision,issues,hiddenTabs:['_V2_LESSON_EVENTS','_V2_EVENT_TEACHERS','_V2_QA_ISSUES'],requires:['TRUSTED_SERVER_IDENTITY','SCHOOL_AUTHORITY','CAS_AND_READBACK','EXPLICIT_OWNER_RELEASE'],operations:[],note:'Pure plan only. Never an executable batchUpdate or school-approved schedule.'};
}
module.exports={DAYS,STARTS,VISIBLE,shadow,overlap,validate,compareVisible,draftPlan};