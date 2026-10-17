/* T3TT Owner V32 browser-only UAT adapter — synthetic records, no network/PII.
 * Mirrors OwnerOperationalDraft client RPC shape; never calls Google APIs.
 * sessionStorage isolates this tab; not an operational personnel datastore.
 */
(()=>{'use strict';
 const KEY='T3TT_V32_UAT_SESSION_ONLY_R1', VERSION='ADMIN_WORKING_V1_2569_T2_UAT_ONLY';
 const HASH='a'.repeat(64),SCHEMA='T3TT_BROWSER_UAT_R1';
 const copy=x=>JSON.parse(JSON.stringify(x)),fault=(m)=>{throw new Error(m)};
 const empty=()=>({revision:0,kind:'SCHOOL_TERM2_DRAFT',term:'2',yearBE:'2569',
    mode:'60',effectiveFrom:'',effectiveTo:'',rows:[]});
 const initial=()=>({schema:SCHEMA,term:'2/2569',revision:0,initialized:false,
   mode:'PROD_WRITE_LOCKED_PENDING_RELEASE',sourceHash:'',scheduleVersion:'',
   draft:empty(),history:[],seen:[]});
 function load(){
   try{let x=JSON.parse(sessionStorage.getItem(KEY)||'null');
     if(x&&x.schema===SCHEMA&&Array.isArray(x.history)&&Array.isArray(x.seen)
        &&typeof x.revision==='number'&&Array.isArray(x.draft.rows))return x;
   }catch(_){}
   return initial();
 }
 function store(s){sessionStorage.setItem(KEY,JSON.stringify(s));return s;}
 const ids=/^[A-Za-z0-9_.:-]{1,100}$/;
 function minute(t){if(typeof t!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))return NaN;return +t.slice(0,2)*60 + +t.slice(3)}
 function validate(rows){
   if(!Array.isArray(rows)||rows.length>600)fault('UAT_ROWS_INVALID');
   const out=[],uni=new Set();
   for(const r of rows){
     if(!r||typeof r!=='object'||!ids.test(r.assignmentId)||uni.has(r.assignmentId)
       ||!ids.test(r.classRef)||!ids.test(r.courseRef)||!ids.test(r.teacherRef)
       ||!ids.test(r.venueRef)||!ids.test(r.periodCode)
       ||(r.coTeacherRef&&!ids.test(r.coTeacherRef))
       ||(r.coTeacherRef&&r.coTeacherRef===r.teacherRef))fault('UAT_ID_INVALID');
     uni.add(r.assignmentId);
     let a=minute(r.startTime),b=minute(r.endTime);
     if(!Number.isInteger(r.weekday)||r.weekday<0||r.weekday>4||
       !Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a!==r.duration_minutes
       ||b-a>480)fault('UAT_TIME_INVALID');
     const staff=[r.teacherRef].concat(r.coTeacherRef?[r.coTeacherRef]:[]);
     for(const old of out){
       if(old.day!==r.weekday||old.b<=a||b<=old.a)continue;
       if(old.cl===r.classRef)fault('UAT_CLASS_COLLISION');
       if(staff.some(t=>old.staff.includes(t)))fault('UAT_TEACHER_COTEACHER_COLLISION');
       if(old.ve===r.venueRef)fault('UAT_ROOM_COLLISION');
     }
     out.push({day:r.weekday,a,b,cl:r.classRef,ve:r.venueRef,staff});
   }
   return true;
 }
 function read(){
   const s=load();return {ok:true,term:s.term,revision:s.revision,initialized:s.initialized,
     mode:s.mode,sourceHash:s.sourceHash,scheduleVersion:s.scheduleVersion,
     published:false,simulated:true,draft:copy(s.draft)};
 }
 const api={
  T3TT_ownerProdDraftReadV1(){return read()},
  T3TT_ownerAdminStartWorkingDraftV1(command){
    if(!command||command.intent!=='START_OWNER_UNPUBLISHED_DRAFT'||
       !/^T3TT-[A-Za-z0-9_-]{12,68}$/.test(String(command.requestId||'')))
        fault('UAT_EXPLICIT_START_REQUIRED');
    let s=load();
    if(s.initialized)fault('UAT_ALREADY_INITIALIZED');
    s.initialized=true;s.mode='DRAFT_WRITE_ENABLED';s.scheduleVersion=VERSION;
    s.sourceHash=HASH;s.history=[{revision:0,txnId:command.requestId,
      at:new Date().toISOString(),rows:[]}];
    store(s);return {ok:true,initialized:true,published:false,
      revision:0,scheduleVersion:VERSION};
  },
  T3TT_ownerProdDraftSaveV1(command){
    let s=load();
    if(!s.initialized||s.mode!=='DRAFT_WRITE_ENABLED')fault('UAT_DRAFT_NOT_STARTED');
    if(!command||command.expectedRevision!==s.revision)fault('UAT_STALE_REVISION_RELOAD');
    if(command.expectedSourceHash!==HASH||command.expectedScheduleVersion!==VERSION)
       fault('UAT_SOURCE_VERSION_CONFLICT');
    if(typeof command.requestId!=='string'||!/^T3TT-[A-Za-z0-9_-]{12,68}$/.test(command.requestId))
       fault('UAT_REQUEST_ID_INVALID');
    let d=command.draft;
    if(!d||d.kind!=='SCHOOL_TERM2_DRAFT'||d.yearBE!=='2569'||d.term!=='2'
      ||d.revision!==s.revision+1||!['50','60'].includes(d.mode))fault('UAT_DRAFT_SHAPE_INVALID');
    validate(d.rows);
    if(s.draft.rows.length&&!d.rows.length)fault('UAT_USE_AUDITED_RESTORE_TO_CLEAR');
    if(s.seen.includes(command.requestId))fault('UAT_DUPLICATE_REQUEST');
    s.revision=d.revision;s.draft=copy(d);s.seen.push(command.requestId);
    s.history.push({revision:s.revision,txnId:command.requestId,
      at:new Date().toISOString(),rows:copy(d.rows)});
    store(s);
    return {ok:true,revision:s.revision,readback:read().revision===s.revision,
      published:false,simulated:true};
  },
  T3TT_ownerProdDraftHistoryV1(){
    let s=load();return {ok:true,history:s.history.map(({revision,txnId,at})=>({revision,txnId,at}))};
  },
  T3TT_ownerProdDraftRestoreV1(cmd){
    let s=load();
    if(!s.initialized||!cmd||cmd.expectedRevision!==s.revision||
       cmd.expectedSourceHash!==HASH||cmd.expectedScheduleVersion!==VERSION)
       fault('UAT_RESTORE_STALE_REVISION');
    let prior=s.history.find(h=>h.txnId===cmd.targetTxnId&&h.revision<s.revision);
    if(!prior)fault('UAT_RESTORE_TARGET_NOT_FOUND');
    let d=copy(s.draft);d.revision=s.revision+1;d.rows=copy(prior.rows);
    validate(d.rows);
    s.revision=d.revision;s.draft=d;
    s.history.push({revision:s.revision,txnId:cmd.requestId,
      at:new Date().toISOString(),rows:copy(d.rows)});
    store(s);return {ok:true,revision:s.revision,idempotent:false,simulated:true};
  }
 };
 function chain(ok,fail){
  const r={
   withSuccessHandler(fn){return chain(fn,fail)},
   withFailureHandler(fn){return chain(ok,fn)}
  };
  Object.keys(api).forEach(key=>r[key]=(...args)=>{
    Promise.resolve().then(()=>api[key](...args)).then(v=>ok&&ok(v),
      e=>fail?fail(e):console.warn('UAT failed',e.message));
  });
  return r;
 }
 window.google={script:{run:chain(null,null)}};
 window.T3TT_UAT_DIAGNOSTICS={
   getState:()=>copy(load()),
   reset:()=>{sessionStorage.removeItem(KEY);return copy(initial())},
   validate:rows=>validate(copy(rows)),
   localOnly:true,schema:SCHEMA
 };
})();