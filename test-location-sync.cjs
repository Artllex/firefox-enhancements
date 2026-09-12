const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const request = {source:'C:\\Downloads\\a.zip',destination:'C:\\temp\\a.zip',startTime:123,sourceUrl:'https://example.com/a.zip'};
let items, sourceExists, size, notified, history;
const sandbox = {
 ChromeUtils:{importESModule(url){
   if (url.includes('DownloadHistory')) return {DownloadHistory:{async addDownloadToHistory(){history++},async updateMetaData(){}}};
   return {Downloads:{PUBLIC:1,async getList(){return {async getAll(){return items}}}}};
 }},
 IOUtils:{async exists(){return sourceExists},async stat(){return {type:'regular',size}}},
 console
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname,'download-location-sync.sys.mjs'),'utf8').replace(/export /g,''),sandbox);
function reset(){sourceExists=false;size=3;notified=0;history=0;items=[{startTime:123,source:{url:request.sourceUrl,isPrivate:false},stopped:true,succeeded:true,target:{path:request.source,size:3,async refresh(){}},_notifyChange(){notified++}}]}
(async()=>{
 reset();await sandbox.synchronize(request);assert.equal(items[0].target.path,request.destination);assert.equal(notified,1);assert.equal(history,1);
 await sandbox.synchronize(request);assert.equal(notified,2); // Retry after persistence failure.
 reset();sourceExists=true;await assert.rejects(sandbox.synchronize(request));assert.equal(notified,0);
 reset();size=4;await assert.rejects(sandbox.synchronize(request));
 reset();items[0].source.isPrivate=true;await assert.rejects(sandbox.synchronize(request));
 reset();items.push({...items[0]});await assert.rejects(sandbox.synchronize(request));
 reset();await assert.rejects(sandbox.synchronize({...request,sourceUrl:'https://other.example/'}));
 reset();await assert.rejects(sandbox.synchronize({...request,destination:'relative.zip'}));
 console.log('PASS: relocation, idempotent retry, source present, wrong size, private, ambiguous, wrong URL, relative path');
})().catch(e=>{console.error(e);process.exitCode=1});
