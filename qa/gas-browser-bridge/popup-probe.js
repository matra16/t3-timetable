'use strict';
document.getElementById('probe').addEventListener('click',async()=>{
 const out=document.getElementById('status');
 out.textContent='Probing editor using scoped MAIN-world read-only API...';
 try{
   const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
   const u=new URL(tab?.url||'about:blank');
   if(u.protocol!=='https:'||u.hostname!=='script.google.com'||!/\/home\/projects\//.test(u.pathname))throw Error('NOT_SCHOOL_SCRIPT_EDITOR_TAB');
   const [run]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:()=>{
     const m=window.monaco;
     let models=[];
     try {models=typeof m?.editor?.getModels==='function'?m.editor.getModels().map(x=>({uri:String(x.uri),chars:x.getValue().length,preview:x.getValue().slice(0,130)})):[];}catch(e){models=[{error:String(e)}];}
     const keys=Object.keys(window).filter(x=>/monaco|code.?mirror|editor/i.test(x)).slice(0,30);
     return {url:location.href,title:document.title,monacoGlobalType:typeof m,models,windowEditorLikeKeys:keys,frameCount:document.querySelectorAll('iframe').length,monacoDomCount:document.querySelectorAll('.monaco-editor').length};
   }});
   out.textContent=JSON.stringify({status:'MAIN_READONLY_PROBE',...run.result},null,2);
 }catch(e){out.textContent='PROBE_BLOCKED: '+String(e?.message||e);}
});
