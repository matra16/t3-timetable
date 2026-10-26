/** Independent, pure weekly-school scheduling engine. No Google Apps Script dependencies. */
export const DAYS=['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์'];
export const PERIODS=[[510,570],[570,630],[630,690],[750,810],[810,870],[870,930]];
const COLS=[9,14,19,29,34,39], LETTERS=['J','O','T','AD','AI','AN'];
const text=v=>String(v??'').trim();
const normalize=v=>text(v).replace(/\s+/g,' ');
const clone=v=>structuredClone(v);
const ensure=(b,error)=>{if(!b)throw Error(error)};
export const time=n=>`${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
export function periodLabel(minutes,n){return minutes===60?`ชั่วโมงเรียนที่ ${n}`:minutes===50?`คาบเรียนที่ ${n}`:`ช่วงเรียนที่ ${n} (${minutes} นาที)`}
export const key=(day,klass,period)=>`${day}|${klass}|${period}`;
export function fromNative(input){
 ensure(input && Array.isArray(input.days) && input.days.length===5,'FIVE_DAYS_REQUIRED');
 const geom=input.geometry??PERIODS;
 ensure(Array.isArray(geom)&&geom.length===6&&geom.every(a=>Array.isArray(a)&&a.length===2&&Number.isInteger(a[0])&&Number.isInteger(a[1])&&a[1]>a[0]&&a[1]-a[0]<=180),'GEOMETRY_INVALID');
 const expected=Number(input.classCount||16);ensure(expected===16,'EXPECTED_16_CLASSES');
 const lessons=[],classes=[],seen=new Set();let blank=0, coCount=0, noCodes=0;
 for(let d=0;d<5;d++){
  const source=input.days[d];ensure(source?.day===DAYS[d]&&Array.isArray(source.grid),'WEEKDAY_SOURCE_INVALID');
  for(let c=0;c<16;c++){
   const row=5+2*c,leadRow=source.grid[row]||[],coRow=source.grid[row+1]||[];
   const klass=text(leadRow[2]);ensure(/^ป\.[1-6]\/\d+$/.test(klass),'CLASS_INVALID');
   if(d===0){ensure(!classes.includes(klass),'DUPLICATE_CLASS');classes.push(klass)}
   else ensure(classes[c]===klass,'CLASS_ORDER_DRIFT');
   for(let p=0;p<6;p++){
    const slot=key(source.day,klass,p+1);ensure(!seen.has(slot),'DUPLICATE_SLOT');seen.add(slot);
    const col=COLS[p],subject=normalize(leadRow[col]);if(!subject){blank++;continue}
    const lead=normalize(leadRow[col+1]),co=normalize(coRow[col+1]);
    const teachers=[...new Set([lead,co].filter(Boolean))];
    const codes=subject.match(/[ก-ฮ][0-9]{5}/g)||[];const courseCode=codes.length===1?codes[0]:null;
    if(!courseCode)noCodes++;
    coCount+=teachers.length-(lead?1:0);
    lessons.push({id:`LESSON-${d+1}-${String(c+1).padStart(2,'0')}-${p+1}`,slot,day:source.day,classId:klass,period:p+1,
      start:geom[p][0],end:geom[p][1],subject,courseCode,teachers,leadTeacher:lead,coTeachers:teachers.filter(t=>t!==lead),
      room:normalize(leadRow[col+2]),sourceCell:`ลงตารางวัน${source.day}!${LETTERS[p]}${row+1}`,approved:false});
   }
  }
 }
 ensure(seen.size===480&&blank+lessons.length===480,'CAPACITY_INVALID');
 return {schema:'T3_V4_WEEKLY_1',origin:'SCHOOL_DEV_LOCAL_COPY',sourceId:input.sourceId||'',approved:false,classes,geometry:geom,lessons,capacity:480,blank,coTeacherLinks:coCount,unknownCodes:noCodes,version:0};
}
export function synthetic(){
 const classes=['ป.1/1','ป.1/2','ป.2/1','ป.2/2','ป.3/1','ป.3/2','ป.3/3','ป.4/1','ป.4/2','ป.4/3','ป.5/1','ป.5/2','ป.5/3','ป.6/1','ป.6/2','ป.6/3'];
 const subjects=['ภาษาไทย','คณิตศาสตร์','วิทยาศาสตร์','ภาษาอังกฤษ','สังคมศึกษา','กิจกรรมแนะแนว'];
 const days=DAYS.map((day,d)=>{const grid=Array.from({length:37},()=>[]);for(let c=0;c<16;c++){
  const row=5+c*2;grid[row][2]=classes[c];for(let p=0;p<6;p++){
   if(d===4&&p===5&&c%3===0)continue;
   const col=COLS[p];grid[row][col]=subjects[(d+p+c)%6];grid[row][col+1]=`ครูสมมุติ${c+1}`;grid[row][col+2]=`ห้องสมมุติ${c+1}`;
   if(c===0&&p===1)grid[row+1][col+1]='ครูผู้สอนร่วมสมมุติ';
  }
 }return {day,grid}});
 return {...fromNative({days,sourceId:'SYNTHETIC_ONLY'}),origin:'SYNTHETIC_ONLY'};
}
export function conflicts(model){
 const collisions=[],lessons=model.lessons||[],used=new Map();
 for(const l of lessons){
  ensure(DAYS.includes(l.day)&&l.start<l.end,'LESSON_TIME_INVALID');
  const resources=[['CLASS',l.classId],...l.teachers.map(t=>['TEACHER',t]),...(l.room?[['ROOM',l.room]]:[])];
  for(const [type,id] of resources){if(!id)continue;const k=type+'|'+l.day+'|'+id,arr=used.get(k)||[];
   for(const other of arr){if(other.id!==l.id&&l.start<other.end&&other.start<l.end){collisions.push({type,day:l.day,resource:id,first:other.id,second:l.id,firstClass:other.classId,secondClass:l.classId,period:l.period})}}
   arr.push(l);used.set(k,arr);
  }
 }
 return collisions;
}
export function stats(model){const c=conflicts(model);return {classes:model.classes.length,total:480,assigned:model.lessons.length,blank:480-model.lessons.length,coTeacherLinks:model.lessons.reduce((s,l)=>s+l.coTeachers.length,0),teacherRefs:model.lessons.reduce((s,l)=>s+l.teachers.length,0),unknownCodes:model.lessons.filter(l=>!l.courseCode).length,collisions:c.length,byType:Object.fromEntries(['CLASS','TEACHER','ROOM'].map(k=>[k,c.filter(x=>x.type===k).length]))}}
export function change(model,operation){
 ensure(operation&&['MOVE','SWAP'].includes(operation.type),'OP_INVALID');const after=clone(model),a=after.lessons.find(l=>l.id===operation.id);ensure(a,'LESSON_ID_INVALID');
 const place=(l,d,cls,p)=>{ensure(DAYS.includes(d)&&after.classes.includes(cls)&&Number.isInteger(p)&&p>=1&&p<=6,'DESTINATION_INVALID');
  const geom=after.geometry[p-1];Object.assign(l,{day:d,classId:cls,period:p,start:geom[0],end:geom[1],slot:key(d,cls,p)})};
 if(operation.type==='SWAP'){
  const b=after.lessons.find(l=>l.id===operation.otherId);ensure(b&&a.id!==b.id,'SWAP_INVALID');
  const x={day:a.day,classId:a.classId,period:a.period},y={day:b.day,classId:b.classId,period:b.period};place(a,y.day,y.classId,y.period);place(b,x.day,x.classId,x.period);
 }else{
  const t=operation.target||{};ensure(!after.lessons.some(l=>l.id!==a.id&&l.day===t.day&&l.classId===t.classId&&l.period===t.period),'TARGET_OCCUPIED');place(a,t.day,t.classId,t.period);
 }
 const before=conflicts(model),post=conflicts(after);
 const keyC=c=>`${c.type}|${c.resource}|${[c.first,c.second].sort().join('|')}`;
 const baseline=new Set(before.map(keyC)),added=post.filter(x=>!baseline.has(keyC(x)));
 return {ok:added.length===0,model:after,operation,newConflicts:added,previousConflicts:before.length,afterConflicts:post.length};
}
export function csv(model){const rows=[['วัน','ห้อง','ชั่วโมงเรียน','เริ่ม','สิ้นสุด','รายวิชา','ครูหลัก','ผู้สอนร่วม','ห้องสอน','สถานะ'],...model.lessons.map(l=>[l.day,l.classId,String(l.period),time(l.start),time(l.end),l.subject,l.leadTeacher,l.coTeachers.join(' / '),l.room,'DRAFT'])];
 return rows.map(r=>r.map(v=>'"'+String(v??'').replace(/^([=+@-])/,'\'$1').replaceAll('"','""')+'"').join(',')).join('\r\n')}
