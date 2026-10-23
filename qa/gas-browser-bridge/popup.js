'use strict';
const SHA='fe3742293e2b296b24d512bb29568f0ea09ed2c820ea61b35240c75ff1e264f9';
const status=document.querySelector('#status');
function show(value){status.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);}
function isAllowed(u){try{const x=new URL(u);return x.protocol==='https:'&&x.hostname==='script.google.com';}catch{return false;}}
async function inspect(){
  show('Inspecting authorized current tab...');
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.id||!isAllowed(tab.url)){show('STOP: Select an https://script.google.com tab first. No code was read or changed.');return;}
    const [run]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>{
      const url=location.href;
      const editable=[...document.querySelectorAll('textarea,[contenteditable="true"],[role="textbox"]')].slice(0,30);
      return {pageUrl:url,pageTitle:document.title,monacoElements:document.querySelectorAll('.monaco-editor').length,codeMirrorElements:document.querySelectorAll('.CodeMirror').length,editables:editable.map(e=>({tag:e.tagName,role:e.getAttribute('role'),ariaLabel:e.getAttribute('aria-label'),className:String(e.className).slice(0,100)})),saveButtons:[...document.querySelectorAll('button,[role="button"]')].filter(e=>/save|บันทึก/i.test([e.textContent,e.getAttribute('aria-label'),e.title].join(' '))).slice(0,10).map(e=>({text:e.textContent?.trim().slice(0,60),label:e.getAttribute('aria-label')})),projectTempTitle:/T3TT_HELLO_WORLD_TEMP_/i.test(document.title)};
    }});
    if(!run?.result||!isAllowed(run.result.pageUrl)){throw Error('Editor source not from authorized origin');}
    show({status:'READ_ONLY_OBSERVED',tabId:tab.id,...run.result,cloudSourceSaved:false,publicDeployed:false});
  }catch(e){show('READ_ONLY_TOOL_BLOCKED: '+String(e.message||e));}
}
document.querySelector('#inspect').addEventListener('click',inspect);
document.querySelector('#source').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file){return;}
 try{
   const buf=await file.arrayBuffer();
   const h=await crypto.subtle.digest('SHA-256',buf);
   const sha=[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');
   show({fileName:file.name,bytes:buf.byteLength,sha256:sha,verified:sha===SHA,action:'LOCAL_SHA_CHECK_ONLY__NO_GAS_WRITE'});
 }catch(err){show('FILE_CHECK_FAILED: '+String(err.message||err));}
});
