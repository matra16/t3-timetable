'use strict';
(() => {
const PIN='fe3742293e2b296b24d512bb29568f0ea09ed2c820ea61b35240c75ff1e264f9';
const TARGET='T3TT_HELLO_WORLD_TEMP_20261023_DELETE';
const source=document.getElementById('source'),confirm=document.getElementById('ownerVerified'),stage=document.getElementById('stage'),verify=document.getElementById('verifyModel'),out=document.getElementById('status');
let fileBytes=null, fileText=null, hashOK=false;
function message(v){out.textContent=typeof v==='string'?v:JSON.stringify(v,null,2);}
function checkButtons(){stage.disabled=!(hashOK&&confirm.checked);verify.disabled=!hashOK;}
const canonical=s=>s.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
confirm.addEventListener('change',checkButtons);
source.addEventListener('change',async()=>{
 hashOK=false;fileBytes=null;fileText=null;checkButtons();
 try {
  const f=source.files?.[0];
  if(!f) return;
  const bytes=await f.arrayBuffer();
  const bin=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
  const sha=[...bin].map(v=>v.toString(16).padStart(2,'0')).join('');
  hashOK=sha===PIN&&bytes.byteLength===949;
  if(hashOK){fileBytes=bytes;fileText=new TextDecoder().decode(bytes);}
  checkButtons();
  message({localFile:f.name,bytes:bytes.byteLength,sha256:sha,verified:hashOK,action:'NO_GOOGLE_WRITE_YET'});
 } catch(e){message('SOURCE_FAIL:'+String(e.message||e));}
});
async function guardedAction(action) {
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 const url=new URL(tab?.url||'about:blank');
 if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/home\/projects\/[A-Za-z0-9_-]+\/edit\/?$/.test(url.pathname))throw Error('NOT_SCOPED_GOOGLE_GAS_EDITOR');
 const args=[action==='write'?fileText:null,TARGET];
 const [r]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',args,func:(sourceText,target)=>{
   if(location.hostname!=='script.google.com'||!/^\/home\/projects\/[A-Za-z0-9_-]+\/edit\/?$/.test(location.pathname))throw Error('WRONG_ORIGIN_OR_EDITOR');
   if(!document.title.startsWith(target+' - '))throw Error('WRONG_PROJECT_TITLE');
   const m=window.monaco;
   if(!m?.editor?.getModels)throw Error('MONACO_NOT_AVAILABLE');
   const models=m.editor.getModels();
   if(models.length!==1)throw Error('MODEL_COUNT_'+models.length);
   const model=models[0],uri=String(model.uri);
   if(!uri.endsWith('/file_1.js'))throw Error('UNEXPECTED_MODEL_'+uri);
   const canonical=s=>s.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
   const before=model.getValue();
   if(sourceText!==null) {
     if(!sourceText.includes('function doGet()')||!sourceText.includes('Hello World!'))throw Error('UNEXPECTED_SOURCE');
     if(!before.includes('function myFunction()')&&canonical(before)!==canonical(sourceText))throw Error('REFUSE_TO_OVERWRITE_EXISTING_NONDEMO_CODE');
     if(canonical(before)!==canonical(sourceText))model.setValue(sourceText);
   }
   const after=model.getValue();
   return {projectTitle:document.title,modelUri:uri,beforeLength:before.length,afterLength:after.length,afterEqualsApprovedSource:sourceText===null?null:canonical(after)===canonical(sourceText),containsHelloWorld:after.includes('Hello World!'),containsDoGet:after.includes('function doGet()'),action:sourceText===null?'READ_ONLY_MODEL_VERIFY':'LOCAL_EDITOR_MODEL_WRITE_NOT_GOOGLE_SAVED',cloudSaveVerified:false,versionedDeployVerified:false};
 }});
 return r.result;
}
stage.addEventListener('click',async()=>{
 if(!hashOK||!confirm.checked||!fileText){message('BLOCKED_MISSING_SHA_OR_SCHOOL_IDENTITY_CONFIRMATION');return;}
 stage.disabled=true;
 try {message(await guardedAction('write'));}
 catch(e){message('WRITE_BLOCKED:'+String(e.message||e));}
 finally{checkButtons();}
});
verify.addEventListener('click',async()=>{
 try{
  const result=await guardedAction('verify');
  // Ensure actual bytes are compared on the caller side, without any network transfer.
  message({...result,expectedApprovedFileBytes:fileBytes?.byteLength||0,proof:'MONACO_LIVE_EDITOR_ONLY_NOT_CLOUD_SAVE'});
 }catch(e){message('VERIFY_BLOCKED:'+String(e.message||e));}
});
})();
