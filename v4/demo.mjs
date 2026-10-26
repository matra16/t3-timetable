import {synthetic,stats,periodLabel,time,DAYS} from './engine.mjs';
const model=synthetic(),s=stats(model),$=id=>document.getElementById(id);
const txt=(tag,value,cls)=>{const a=document.createElement(tag);a.textContent=value;if(cls)a.className=cls;return a};
let view='class',selected='';
$('classes').textContent=s.classes;$('assigned').textContent=s.assigned;$('blank').textContent=s.blank;$('conflicts').textContent=s.collisions;
const uniq=a=>[...new Set(a.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
function render(){
 const all=model.lessons,choices=view==='class'?model.classes:view==='teacher'?uniq(all.flatMap(x=>x.teachers)):uniq(all.map(x=>x.room));
 if(!choices.includes(selected))selected=choices[0];
 const dropdown=$('entity');dropdown.replaceChildren();for(const name of choices){const o=document.createElement('option');o.value=name;o.textContent=name;dropdown.append(o)}dropdown.value=selected;
 for(const b of document.querySelectorAll('[data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===view));
 const subset=all.filter(l=>view==='class'?l.classId===selected:view==='teacher'?l.teachers.includes(selected):l.room===selected);
 const tr=txt('tr','');tr.append(txt('th','วัน / เวลา'));
 model.geometry.forEach(([a,b],i)=>tr.append(txt('th',periodLabel(b-a,i+1)+' • '+time(a)+'–'+time(b))));
 $('thead').replaceChildren(tr);const rows=[];
 for(const day of DAYS){const line=txt('tr','');line.append(txt('th',day));for(let p=1;p<=6;p++){
  const td=txt('td',''),lessons=subset.filter(x=>x.day===day&&x.period===p);
  if(!lessons.length)td.append(txt('div','—','empty'));
  for(const l of lessons){const div=txt('div','','lesson');div.append(txt('strong',l.subject),txt('small',view==='class'?l.teachers.join(' / '):l.classId),txt('small',view==='room'?l.teachers.join(' / '):l.room));td.append(div)}line.append(td)
 }rows.push(line)}$('tbody').replaceChildren(...rows)
}
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{view=b.dataset.view;render()});
$('entity').addEventListener('change',e=>{selected=e.target.value;render()});
$('print').addEventListener('click',()=>window.print());
render();