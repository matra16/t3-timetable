/* T3TT Professional Workspace V33 — UI only.
 * Powered by existing Owner V32 browser UAT bridge. This file NEVER reads,
 * sends or mutates operational personnel records or Apps Script production.
 */
(()=>{'use strict';
const DAYS=['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์'];
const CLASS_CODES=['P1_1','P1_2','P2_1','P2_2','P3_1','P3_2','P3_3','P4_1','P4_2','P4_3','P5_1','P5_2','P5_3','P6_1','P6_2','P6_3'];
const VIEWS=['overview','timetable','editor','courses','workload','venues','cover','reports','audit','settings'];
const $=id=>document.getElementById(id);
const create=(tag,txt,cls)=>{const x=document.createElement(tag);if(txt!==undefined)x.textContent=String(txt);if(cls)x.className=cls;return x};
const clear=el=>el.replaceChildren();
const nameCode=v=>String(v||'').trim();
const clone=o=>JSON.parse(JSON.stringify(o));
const toMinute=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t))?+t.slice(0,2)*60 + +t.slice(3):NaN;
const hour=m=>(m/60).toFixed(2);
const idOK=x=>/^[A-Za-z0-9_.:-]{1,100}$/.test(String(x));
let current=null,working=[],dirty=false,editingId='',busy=false,view='overview',history=[],toastTimer;
function notify(message,error=false){
  const box=$('toast');box.textContent=message;box.classList.toggle('bad',error);box.hidden=false;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.hidden=true,4500);
}
function call(name,payload){
 return new Promise((resolve,reject)=>{
  const runner=google.script.run.withSuccessHandler(resolve).withFailureHandler(reject);
  try{if(arguments.length>1)runner[name](payload);else runner[name]();}catch(e){reject(e)}
 });
}
function changeView(target){
 if(!VIEWS.includes(target))return;
 view=target;
 document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!=='view-'+target);
 document.querySelectorAll('[data-view]').forEach(btn=>{
   const active=btn.dataset.view===target;btn.classList.toggle('is-active',active);
   if(active)btn.setAttribute('aria-current','page');else btn.removeAttribute('aria-current');
 });
 const title=$('view-'+target).dataset.title||'T3 TIMETABLE';
 $('crumb').textContent=title;$('topTitle').textContent=title;
 $('shell').classList.remove('menu-open');
 window.scrollTo({top:0,behavior:'instant'});
 renderViews();
}
function setSelect(el,values,allLabel){
 const before=el.value;
 clear(el);
 const first=create('option',allLabel);first.value='all';el.append(first);
 values.forEach(item=>{const opt=create('option',item.label);opt.value=item.id;el.append(opt)});
 el.value=values.some(x=>x.id===before)?before:'all';
}
function renderClassDataList(){
 const el=$('classOptions');clear(el);
 CLASS_CODES.forEach(id=>{const item=create('option');item.value=id;el.append(item)});
}
function showEmpty(el,title,desc,icon='▦'){
 clear(el);
 const wrap=create('div',undefined,'empty-state');
 const mark=create('div',icon,'empty-icon');
 wrap.append(mark,create('strong',title),create('p',desc));el.append(wrap);
}
function getTeachers(){
 return [...new Set(working.flatMap(x=>[x.teacherRef,x.coTeacherRef].filter(Boolean)))].sort();
}
function statusSummary(){
 if(!current)return 'กำลังโหลดสถานะ';
 if(!current.initialized)return 'ยังไม่เริ่มทดลอง Draft';
 return 'UAT Session · Revision '+current.revision+' · ไม่ใช่ข้อมูลโรงเรียน';
}
function renderKPIs(){
 $('metricAssignments').textContent=working.length;
 $('metricTeachers').textContent=getTeachers().length;
 $('metricHours').textContent=hour(working.reduce((n,x)=>n+x.duration_minutes,0));
 $('overviewStatus').textContent=statusSummary();
 $('overviewRevision').textContent='Revision '+(current?.revision||0)+' · '+(dirty?'มีการแก้ไขยังไม่ได้บันทึก':'ไม่มีการแก้ไขค้าง');
 $('editorRevision').textContent='Revision '+(current?.revision||0)+(dirty?' · มีการแก้ไข':'');
 $('settingsRevision').textContent=String(current?.revision||0);
 $('editorMode').textContent=current?.initialized?'พร้อมทดลองบันทึกในแท็บ':'ยังไม่ได้เริ่ม Draft';
 $('state').textContent=statusSummary();
 $('startAdmin').disabled=busy||!!current?.initialized;
 $('save').disabled=busy||!current?.initialized||!dirty;
 $('refresh').disabled=busy;
 $('draftCount').textContent=working.length+' รายการ';
 $('editState').textContent=working.length+' รายการ'+(dirty?' · มีการแก้ไขรอบันทึก':' · บันทึกสถานะล่าสุดแล้ว')+
   (!current?.initialized?' · กดเริ่มทดลอง Draft ก่อนบันทึก':'');
 $('editState').classList.remove('error');
}
function drawWeek(el,selectedClass='all',selectedDay='all'){
 clear(el);
 const arr=working.filter(r=>(selectedClass==='all'||r.classRef===selectedClass)&&
   (selectedDay==='all'||String(r.weekday)===selectedDay));
 for(let day=0;day<5;day++){
  if(selectedDay!=='all'&&String(day)!==selectedDay)continue;
  const card=create('div',undefined,'week-day');
  const head=create('div',undefined,'week-day-hd');
  const lessons=arr.filter(r=>r.weekday===day).sort((a,b)=>toMinute(a.startTime)-toMinute(b.startTime));
  head.append(create('span',DAYS[day]),create('span',String(lessons.length)));
  card.append(head);
  const inside=create('div',undefined,'week-day-content');
  if(!lessons.length)inside.append(create('div','ยังไม่มีรายการ','week-none'));
  lessons.forEach(r=>{
    const it=create('div',undefined,'lesson-card');
    it.append(create('strong',r.classRef+' · '+r.courseRef),
       create('small',r.startTime+'–'+r.endTime+' · '+r.duration_minutes+' นาที'),
       create('small',r.teacherRef+(r.coTeacherRef?' + '+r.coTeacherRef:'')+' · '+r.venueRef));
    inside.append(it);
  });
  card.append(inside);el.append(card);
 }
}
function renderTimetable(){
 const rooms=[...new Set(CLASS_CODES.concat(working.map(r=>r.classRef)))].sort();
 setSelect($('filterClass'),rooms.map(id=>({id,label:id.replace(/^P(\d)_(\d)$/,'ป.$1/$2')})),'ทุกห้อง');
 drawWeek($('overviewWeek'));
 drawWeek($('fullWeek'),$('filterClass').value,$('filterDay').value);
 $('timetableCount').textContent=working.filter(r=>
   ($('filterClass').value==='all'||r.classRef===$('filterClass').value)&&
   ($('filterDay').value==='all'||String(r.weekday)===$('filterDay').value)).length+' รายการ';
}
function makeTable(columns,rows){
 const wrap=create('div',undefined,'table-scroll'),table=create('table',undefined,'data-table');
 const head=create('thead'),line=create('tr');
 columns.forEach(c=>line.append(create('th',c)));
 head.append(line);table.append(head);
 const body=create('tbody');
 rows.forEach(row=>{
  const tr=create('tr');
  row.forEach(v=>{
   const td=create('td');
   if(v instanceof Node)td.append(v);else td.textContent=String(v===undefined?'':v);
   tr.append(td);
  });
  body.append(tr);
 });
 table.append(body);wrap.append(table);return wrap;
}
function renderEditorTable(){
 const pane=$('grid');
 if(!working.length){showEmpty(pane,'ยังไม่มีรายการสอนใน Draft','กรอกข้อมูลตัวอย่างแล้วกดเพิ่มรายการ จากนั้นบันทึก Revision เพื่อทดสอบ');return;}
 clear(pane);
 const arr=working.map(r=>{
  const ops=create('div',undefined,'btn-row');
  const edit=create('button','แก้ไข','btn small');edit.type='button';edit.onclick=()=>editEntry(r.assignmentId);
  const remove=create('button','ลบ','btn small danger');remove.type='button';remove.onclick=()=>deleteEntry(r.assignmentId);
  ops.append(edit,remove);
  const refs=create('span',r.teacherRef+(r.coTeacherRef?' / '+r.coTeacherRef:''));
  const time=create('span',r.startTime+'–'+r.endTime);
  const code=create('span',r.classRef,'row-tag');
  return [code,r.courseRef,refs,DAYS[r.weekday]+' · '+r.periodCode,time,hour(r.duration_minutes)+' ชม.',r.venueRef,ops];
 });
 pane.append(makeTable(['ห้อง','รายวิชา','ครูหลัก / ร่วม','วัน / ช่วง','เวลา','ชั่วโมง','สถานที่','จัดการ'],arr));
}
function validation(row){
 for(const f of ['assignmentId','classRef','courseRef','teacherRef','venueRef','periodCode']){
  if(!idOK(row[f]))throw Error('กรุณากรอกรหัสให้ถูกต้อง: '+f);
 }
 if(row.coTeacherRef&&!idOK(row.coTeacherRef))throw Error('รหัสครูร่วมไม่ถูกต้อง');
 if(row.coTeacherRef&&row.coTeacherRef===row.teacherRef)throw Error('ครูหลักและครูร่วมต้องไม่เป็นคนเดียวกัน');
 const a=toMinute(row.startTime),b=toMinute(row.endTime);
 if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a>480)throw Error('ช่วงเวลาเริ่ม–สิ้นสุดไม่ถูกต้อง');
 if(row.duration_minutes!==b-a)throw Error('จำนวนนาทีไม่ตรงกับเวลาเริ่ม–สิ้นสุด');
 for(const old of working){
   if(old.assignmentId===row.assignmentId)continue;
   if(old.weekday!==row.weekday||toMinute(old.endTime)<=a||b<=toMinute(old.startTime))continue;
   if(old.classRef===row.classRef)throw Error('ห้องเรียนซ้ำในช่วงเวลาเดียวกัน');
   if(old.venueRef===row.venueRef)throw Error('สถานที่ถูกใช้ซ้ำในช่วงเวลาเดียวกัน');
   const staff=[row.teacherRef,row.coTeacherRef].filter(Boolean);
   if([old.teacherRef,old.coTeacherRef].filter(Boolean).some(x=>staff.includes(x)))
    throw Error('ครูหลักหรือครูร่วมมีตารางสอนซ้อนกัน');
 }
 if(working.length>=600&&!editingId)throw Error('เกินขีดจำกัด 600 รายการของ UAT');
 return true;
}
function draftFormValues(){
 const get=id=>String($(id).value||'').trim();
 const s=get('st'),e=get('en');
 return {assignmentId:editingId||'DRAFT-'+crypto.randomUUID(),
   classRef:get('cl'),courseRef:get('co'),teacherRef:get('te'),
   coTeacherRef:get('ct'),venueRef:get('ve'),weekday:Number(get('day')),
   periodCode:get('per'),startTime:s,endTime:e,duration_minutes:toMinute(e)-toMinute(s)};
}
function draftMessage(message,error=false){
 $('editState').textContent=message;$('editState').classList.toggle('error',error);
 notify(message,error);
}
function addEntry(event){
 event?.preventDefault();
 try{
  if(busy)throw Error('ระบบกำลังดำเนินการ');
  if(!current?.initialized)throw Error('กด “เริ่มทดลอง Draft” ก่อนเพิ่มรายการ');
  const row=draftFormValues();validation(row);
  if(editingId){
   const i=working.findIndex(x=>x.assignmentId===editingId);
   if(i<0)throw Error('ไม่พบรายการที่ต้องการแก้ไข');
   working[i]=row;
  }else working.push(row);
  dirty=true;resetEdit();renderViews();changeView('editor');
  draftMessage('เพิ่มข้อมูลในฉบับร่างแล้ว · กรุณากด “บันทึก Revision ใน UAT”');
 }catch(e){draftMessage(e.message||String(e),true)}
}
function deleteEntry(id){
 if(busy)return;
 working=working.filter(r=>r.assignmentId!==id);
 if(editingId===id)resetEdit();
 dirty=true;renderViews();
 notify('ลบรายการจากร่างแล้ว (ยังไม่บันทึก Revision)');
}
function editEntry(id){
 const row=working.find(r=>r.assignmentId===id);if(!row)return;
 editingId=row.assignmentId;
 const values={cl:row.classRef,co:row.courseRef,te:row.teacherRef,
  ct:row.coTeacherRef,ve:row.venueRef,day:String(row.weekday),
  per:row.periodCode,st:row.startTime,en:row.endTime};
 Object.entries(values).forEach(([id,v])=>$(id).value=v);
 $('add').textContent='บันทึกการแก้ไขรายการ';$('cancelEdit').hidden=false;
 changeView('editor');$('cl').focus();notify('กำลังแก้ไขรายการ '+row.assignmentId);
}
function resetEdit(){
 editingId='';
 $('add').textContent='＋ เพิ่มรายการในร่าง';$('cancelEdit').hidden=true;
 for(const id of ['cl','co','te','ct','ve','per'])$(id).value='';
 $('st').value='08:00';$('en').value='08:50';$('day').value='0';
}
function fillSample(){
 // Deterministic synthetic only. Never pull real teacher/course names.
 const next=working.length+1;
 const v={cl:'CLASS_QA'+next,co:'ENG_QA',te:'TEACHER_QA'+next,ct:'',
    ve:'ROOM_QA'+next,day:String((next-1)%5),per:'P0'+(1+(next-1)%6),
    st:'08:00',en:'08:50'};
 Object.entries(v).forEach(([id,val])=>$(id).value=val);
 if(!current?.initialized)notify('กรอกตัวอย่างแล้ว · กดเริ่มทดลอง Draft ก่อนเพิ่มรายการ');
 else notify('กรอกรหัสตัวอย่างพร้อมทดสอบแล้ว');
 changeView('editor');
}
function seedDemo(){
 if(!current?.initialized){notify('กรุณาเริ่มทดลอง Draft ก่อนโหลดชุดตัวอย่าง',true);changeView('editor');return}
 if(busy||working.length||dirty){notify('ชุดตัวอย่างใช้กับ Draft ที่ว่างเท่านั้น เพื่อไม่ทับข้อมูลของคุณ',true);return}
 const dates=['08:00','09:00','10:00'],ends=['08:50','09:50','10:50'];
 const incoming=[];
 for(let i=0;i<12;i++){
  const block=Math.floor(i/5);
  const row={
    assignmentId:'DRAFT-QA-'+String(i+1).padStart(3,'0'),
    classRef:CLASS_CODES[i],courseRef:['ENG_QA','MATH_QA','SCI_QA'][i%3],
    teacherRef:'TEACHER_QA'+(i%6+1),
    coTeacherRef:(i===2||i===7)?'COTEACHER_QA1':'',
    venueRef:'ROOM_QA'+(i+1),weekday:i%5,
    periodCode:'P0'+(block+1),
    startTime:dates[block],endTime:ends[block],duration_minutes:50
  };
  validation(row);incoming.push(row);
 }
 working=incoming;dirty=true;renderViews();changeView('editor');
 notify('สร้างข้อมูลสมมติ 12 รายการแล้ว · ตรวจตารางและกดบันทึก Revision ใน UAT');
}
async function refresh({silent=false}={}){
 if(busy)return;
 if(dirty&&!silent&&!window.confirm('มีรายการแก้ไขที่ยังไม่บันทึก ต้องการอ่าน Session ล่าสุดแล้วแทนที่ร่างปัจจุบันหรือไม่?'))return;
 busy=true;
 try{
  const [snap,log]=await Promise.all([call('T3TT_ownerProdDraftReadV1'),call('T3TT_ownerProdDraftHistoryV1')]);
  current=snap;working=Array.isArray(snap.draft?.rows)?clone(snap.draft.rows):[];
  history=Array.isArray(log.history)?log.history:[];
  dirty=false;editingId='';resetEdit();
  renderViews();if(!silent)notify('อ่านสถานะ UAT Session สำเร็จ');
 }catch(e){notify('อ่านข้อมูล UAT ไม่สำเร็จ: '+(e.message||e),true)}
 finally{busy=false;renderKPIs()}
}
async function startAdminDraft(){
 if(busy||current?.initialized)return;
 busy=true;renderKPIs();
 try{
  await call('T3TT_ownerAdminStartWorkingDraftV1',{
     requestId:'T3TT-ADMIN-'+crypto.randomUUID(),intent:'START_OWNER_UNPUBLISHED_DRAFT'
  });
  busy=false;await refresh({silent:true});
  changeView('editor');notify('เริ่ม Draft จำลองแล้ว · Revision 0');
 }catch(e){busy=false;notify('เริ่ม Draft ไม่สำเร็จ: '+(e.message||e),true)}
 finally{renderKPIs()}
}
async function saveDraft(){
 if(busy||!dirty)return;
 if(!current?.initialized){notify('ยังไม่ได้เริ่มทดลอง Draft',true);return}
 busy=true;renderKPIs();
 try{
  const d=clone(current.draft);d.revision=current.revision+1;d.rows=clone(working);
  const result=await call('T3TT_ownerProdDraftSaveV1',{
    requestId:'T3TT-SAVE-'+crypto.randomUUID(),
    expectedRevision:current.revision,expectedSourceHash:current.sourceHash,
    expectedScheduleVersion:current.scheduleVersion,draft:d
  });
  dirty=false;busy=false;
  await refresh({silent:true});
  notify('บันทึกใน UAT Session สำเร็จ · Revision '+result.revision);
  changeView('editor');
 }catch(e){busy=false;renderViews();notify('ไม่สามารถบันทึก UAT Session: '+(e.message||e),true)}
}
function grouped(key,includeCo=false){
 const map=new Map();
 working.forEach(r=>{
  const keys=includeCo?[r.teacherRef,r.coTeacherRef].filter(Boolean):[r[key]];
  keys.forEach(id=>{
   const x=map.get(id)||{id,assignments:0,minutes:0,primary:0,co:0};
   x.assignments++;x.minutes+=r.duration_minutes;
   if(includeCo){if(r.teacherRef===id)x.primary++;else x.co++}
   map.set(id,x);
  });
 });
 return [...map.values()].sort((a,b)=>b.minutes-a.minutes||a.id.localeCompare(b.id));
}
function drawGrouped(el,key,emptyMsg,co=false){
 if(!working.length){showEmpty(el,'ยังไม่มีข้อมูล',emptyMsg,'◷');return}
 const rows=grouped(key,co);
 if(!rows.length){showEmpty(el,'ไม่พบรายการ','โปรดเพิ่มรายการใน Draft');return}
 const max=Math.max(...rows.map(x=>x.minutes),1);
 const v=rows.map(x=>{
  const meter=create('div',undefined,'mini-progress');
  const progress=create('div');progress.style.width=Math.round(x.minutes/max*100)+'%';
  meter.append(progress);
  return [create('strong',x.id),String(x.assignments),hour(x.minutes)+' ชม.',
    co?'หลัก '+x.primary+' / ร่วม '+x.co:'—',meter];
 });
 clear(el);el.append(makeTable([co?'รหัสผู้สอน':key==='courseRef'?'รหัสวิชา':'รหัสสถานที่',
    'รายการ','เวลารวม','บทบาท','สัดส่วน'],v));
}
function drawCover(){
 const teacher=$('coverTeacher').value,day=Number($('coverDay').value),lessonID=$('coverLesson').value;
 const result=$('coverResult');
 if(!teacher||!lessonID){showEmpty(result,'เลือกผู้สอนและช่วงสอน','ระบบจะแนะนำเฉพาะความว่างเชิงเวลาในข้อมูลจำลอง','⇄');return}
 const lesson=working.find(r=>r.assignmentId===lessonID&&r.weekday===day);
 if(!lesson){showEmpty(result,'ไม่มีข้อมูลช่วงสอน','เลือกรายการสอนที่มีใน Session');return}
 const start=toMinute(lesson.startTime),end=toMinute(lesson.endTime);
 const candidates=getTeachers().filter(id=>{
  if(id===teacher||id===lesson.teacherRef||id===lesson.coTeacherRef)return false;
  return !working.some(r=>r.weekday===day&&(r.teacherRef===id||r.coTeacherRef===id)&&
   toMinute(r.startTime)<end&&toMinute(r.endTime)>start);
 });
 clear(result);
 result.append(create('div','ช่วง '+lesson.startTime+'–'+lesson.endTime+' · '+lesson.classRef+' · '+lesson.courseRef,'kicker'));
 if(!candidates.length){showEmpty(result,'ไม่พบผู้สอนว่างจากรายการใน UAT','ต้องตรวจตารางและข้อมูลคุณสมบัติจริงก่อนใช้งาน');return}
 const h=create('p',undefined,'note-line');h.textContent='พบ '+candidates.length+' รหัสครูที่ไม่ชนตามเวลาเท่านั้น (ไม่ใช่การอนุมัติสอนแทน)';result.append(h);
 candidates.forEach(id=>{
  const item=create('div',undefined,'summary-strip');item.style.marginTop='7px';
  item.append(create('strong',id),create('span','ไม่พบช่วงเวลาชน · ยังไม่ตรวจคุณสมบัติ'));
  result.append(item);
 });
}
function drawCoverControls(){
 const teachers=getTeachers(),before=$('coverTeacher').value;
 clear($('coverTeacher'));const op=create('option','เลือกผู้สอนรหัสตัวอย่าง');op.value='';$('coverTeacher').append(op);
 teachers.forEach(id=>{const o=create('option',id);o.value=id;$('coverTeacher').append(o)});
 $('coverTeacher').value=teachers.includes(before)?before:'';
 const t=$('coverTeacher').value,day=+$('coverDay').value,old=$('coverLesson').value;
 const lessons=working.filter(r=>r.weekday===day&&(r.teacherRef===t||r.coTeacherRef===t));
 clear($('coverLesson'));const zero=create('option','เลือกรายการสอน');zero.value='';$('coverLesson').append(zero);
 lessons.forEach(r=>{const o=create('option',r.classRef+' · '+r.startTime+'–'+r.endTime);o.value=r.assignmentId;$('coverLesson').append(o)});
 $('coverLesson').value=lessons.some(r=>r.assignmentId===old)?old:'';
}
function drawHistory(){
 const list=$('auditEntries');
 if(!history.length){showEmpty(list,'ยังไม่มีประวัติ Revision','เริ่ม Session และบันทึกอย่างน้อยหนึ่งครั้ง');return}
 clear(list);
 [...history].reverse().forEach(h=>{
  const item=create('div',undefined,'timeline-event');
  const t=create('time',h.at?new Date(h.at).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'}):'—');
  const body=create('div',undefined,'timeline-detail');
  body.append(create('strong','Revision '+h.revision),create('small',h.txnId||'INIT'));
  item.append(t,body);list.append(item);
 });
 const before=$('history').value;clear($('history'));
 const ph=create('option','เลือกรุ่นเพื่อ Restore');ph.value='';$('history').append(ph);
 history.filter(h=>h.revision<current.revision).forEach(h=>{
  const op=create('option','Revision '+h.revision);op.value=h.txnId;$('history').append(op);
 });
 if(history.some(h=>h.txnId===before&&h.revision<current.revision))$('history').value=before;
 $('restore').disabled=!current?.initialized||!$('history').value;
 $('restoreStatus').textContent='Restore จะสร้าง Revision '+((current?.revision||0)+1)+' และไม่แก้ตารางจริง';
}
async function restoreDraft(){
 const target=$('history').value;
 if(!target||busy||!current?.initialized)return;
 if(!window.confirm('คืนค่า UAT Revision ที่เลือก โดยสร้าง Revision ใหม่ใช่หรือไม่?'))return;
 busy=true;
 try{
  const res=await call('T3TT_ownerProdDraftRestoreV1',{
   requestId:'T3TT-RESTORE-'+crypto.randomUUID(),targetTxnId:target,
   expectedRevision:current.revision,expectedSourceHash:current.sourceHash,
   expectedScheduleVersion:current.scheduleVersion
  });
  busy=false;dirty=false;await refresh({silent:true});
  changeView('audit');notify('ทดลอง Restore สำเร็จ · Revision '+res.revision);
 }catch(e){notify('Restore ไม่สำเร็จ: '+(e.message||e),true)}
 finally{busy=false}
}
function drawReport(){
 const el=$('reportOutput');clear(el);
 el.append(create('h3','รายงานทดสอบตารางเรียนและตารางสอน · ภาคเรียน 2/2569'));
 el.append(create('p','UAT ข้อมูลจำลอง ไม่รับรองและไม่ใช้เป็นตารางสอนราชการ','note-line'));
 const stats=[['รายการสอนทั้งหมด',working.length+' รายการ'],
   ['ระยะเวลาเรียนรวม',hour(working.reduce((s,r)=>s+r.duration_minutes,0))+' ชั่วโมง'],
   ['จำนวนรหัสผู้สอน',getTeachers().length+' รหัส'],
   ['Revision ใน Session',String(current?.revision||0)],
   ['สถานะ','ยังไม่ประกาศใช้ · Session ทดลอง']];
 stats.forEach(([key,value])=>{const row=create('div',undefined,'report-line');row.append(create('span',key),create('strong',value));el.append(row)});
 const list=grouped('teacherRef',true);
 if(list.length){
  el.append(create('h3','ภาระงานรหัสครู (จากเวลาจริง)'));
  el.append(makeTable(['รหัสผู้สอน','จำนวนรายการ','ชั่วโมงรวม','ครูหลัก/ร่วม'],
   list.map(x=>[x.id,String(x.assignments),hour(x.minutes),x.primary+' / '+x.co])));
 }
 el.append(create('p','เอกสารทดสอบเท่านั้น — ห้ามใช้แทนตารางสอนที่ลงนาม','note-line'));
}
function renderViews(){
 renderKPIs();renderEditorTable();renderTimetable();
 drawGrouped($('courseList'),'courseRef','เพิ่มรายการสอนเพื่อสรุปรายวิชา');
 drawGrouped($('workloadList'),'teacherRef','เพิ่มรายการสอนเพื่อสรุปภาระงาน',true);
 drawGrouped($('venueList'),'venueRef','เพิ่มรายการสอนเพื่อสรุปการใช้สถานที่');
 drawCoverControls();drawCover();drawHistory();drawReport();
}
function hookEvents(){
 document.querySelectorAll('[data-view]').forEach(x=>x.addEventListener('click',()=>changeView(x.dataset.view)));
 document.querySelectorAll('[data-go]').forEach(x=>x.addEventListener('click',()=>changeView(x.dataset.go)));
 $('menuTrigger').addEventListener('click',()=>$('shell').classList.add('menu-open'));
 $('scrim').addEventListener('click',()=>$('shell').classList.remove('menu-open'));
 $('refresh').addEventListener('click',()=>refresh());
 $('startAdmin').addEventListener('click',startAdminDraft);
 $('draftForm').addEventListener('submit',addEntry);
 $('sample').addEventListener('click',fillSample);
 $('seedOverview').addEventListener('click',seedDemo);
 $('seedEditor').addEventListener('click',seedDemo);
 $('cancelEdit').addEventListener('click',resetEdit);
 $('save').addEventListener('click',saveDraft);
 $('filterClass').addEventListener('change',()=>renderTimetable());
 $('filterDay').addEventListener('change',()=>renderTimetable());
 $('clearFilters').addEventListener('click',()=>{$('filterClass').value='all';$('filterDay').value='all';renderTimetable()});
 $('coverDay').addEventListener('change',drawCoverControls);
 $('coverTeacher').addEventListener('change',drawCoverControls);
 $('coverLesson').addEventListener('change',drawCover);
 $('findCover').addEventListener('click',drawCover);
 $('history').addEventListener('change',()=>{$('restore').disabled=!$('history').value});
 $('restore').addEventListener('click',restoreDraft);
 $('printBtn').addEventListener('click',()=>window.print());
 $('resetSession').addEventListener('click',()=>{
   if(!window.confirm('ล้างเฉพาะข้อมูลจำลองของแท็บนี้และเริ่ม Session ใหม่?'))return;
   T3TT_UAT_DIAGNOSTICS.reset();current=null;working=[];history=[];dirty=false;
   resetEdit();refresh({silent:true}).then(()=>{changeView('overview');notify('ล้างข้อมูล UAT Session แล้ว')});
 });
 window.addEventListener('beforeunload',e=>{
   if(dirty){e.preventDefault();e.returnValue=''}
 });
}
function start(){
 renderClassDataList();hookEvents();
 const target=new URLSearchParams(location.search).get('view');
 changeView(VIEWS.includes(target)?target:'overview');
 refresh({silent:true});
}
document.addEventListener('DOMContentLoaded',start);
window.T3TT_PRO_DIAGNOSTICS={getState:()=>({view,current:clone(current),working:clone(working),dirty}),
 showView:changeView,localOnly:true,version:'V33'};
})();