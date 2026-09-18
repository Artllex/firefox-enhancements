const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
let buffer = Buffer.alloc(0), nextId = 0;
const pending = new Map();
const socket = net.connect(2837, '127.0.0.1');
socket.on('data', data => {
  buffer = Buffer.concat([buffer, data]);
  while (true) {
    const colon = buffer.indexOf(':');
    if (colon < 0) break;
    const size = Number(buffer.subarray(0, colon).toString());
    if (buffer.length < colon + 1 + size) break;
    const message = JSON.parse(buffer.subarray(colon + 1, colon + 1 + size).toString());
    buffer = buffer.subarray(colon + 1 + size);
    if (Array.isArray(message)) {
      const task = pending.get(message[1]);
      if (task) { pending.delete(message[1]); message[2] ? task.reject(Error(JSON.stringify(message[2]))) : task.resolve(message[3]); }
    }
  }
});
function command(name, args = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, {resolve, reject});
    const body = JSON.stringify([0, id, name, args]);
    socket.write(Buffer.byteLength(body) + ':' + body);
  });
}
async function script(script, args = []) {
  return command('WebDriver:ExecuteScript', {script, args, newSandbox: false, sandbox: 'system'});
}
(async () => {
  await new Promise((resolve, reject) => { socket.on('connect', resolve); socket.on('error', reject); });
  await command('WebDriver:NewSession', {capabilities: {alwaysMatch: {acceptInsecureCerts: true}}});
  await command('Marionette:SetContext', {value: 'chrome'});
  if (process.env.FE_LIBRARY_TEST === '1') {
    const result=await command('WebDriver:ExecuteAsyncScript',{script:`
      const done=arguments[arguments.length-1];
      (async()=>{
        Services.io.getProtocolHandler('resource').QueryInterface(Ci.nsIResProtocolHandler).setSubstitution('artllex-shared',Services.io.newFileURI(Services.dirsvc.get('GreD',Ci.nsIFile)));
        ChromeUtils.importESModule('resource://artllex-shared/FirefoxEnhancementsLibrary.sys.mjs').start();
        const browser=Services.wm.getMostRecentWindow('navigator:browser');
        for(const old of Services.wm.getEnumerator('Places:Organizer')) old.close();
        await new Promise(r=>browser.setTimeout(r,1000));
        browser.PlacesCommandHook.showPlacesOrganizer('History');
        await new Promise(r=>browser.setTimeout(r,1000));
        const win=Services.wm.getMostRecentWindow('Places:Organizer');
        if(win.document.readyState!=='complete') await new Promise(r=>win.addEventListener('load',r,{once:true}));
        await new Promise(r=>win.setTimeout(r,500));
        const cols=[...win.document.querySelectorAll('[fe-library-column]')];
        if(cols.slice(0,-1).some(column=>column.nextElementSibling?.localName!=='splitter') || cols.at(-1)?.nextElementSibling?.localName==='splitter') throw Error('Library column splitter order failed');
        const view=Object.create(win.PlacesTreeView.prototype);
        view._getNodeForRow=()=>({uri:'https://example.org/folder/page?q=hello#part'});
        view._findColumnByType=()=>({element:{getAttribute:name=>name==='anonid'?'title':''}});
        const values=cols.map(element=>view.getCellText(0,{element}));
        view._getNodeForRow=()=>({uri:'https://www.example.org/folder/page?q=hello#part',icon:'https://example.org/favicon.ico'});
        if(view.getCellText(0,{element:cols[0]})!=='example.org' || view.getImageSrc(0,{element:cols[0]})!=='https://example.org/favicon.ico') throw Error('Domain normalization/favicon failed');
        const mockTitle={element:{getAttribute:name=>name==='anonid'?'title':''}};
        if(view.getImageSrc(0,mockTitle)!=='https://example.org/favicon.ico') throw Error('Native Name favicon was changed');
        const {PlacesUtils}=ChromeUtils.importESModule('resource://gre/modules/PlacesUtils.sys.mjs');
        const url='https://example.org/folder/page?q=hello#part';
        await PlacesUtils.history.insert({url,title:'FE test',visits:[{date:new Date()}]});
        const tree=win.document.getElementById('placeContent');
        tree.place='place:sort=4&type=0';
        await new Promise(r=>win.setTimeout(r,300));
        let row=-1;
        for(let i=0;i<tree.view.rowCount;i++){if(tree.view._getNodeForRow(i).uri===url){row=i;break;}}
        if(row<0) throw Error('Test history row missing');
        const originalHit=tree.getCellAt;
        tree.getCellAt=()=>({row,col:{element:cols[6]}});
        tree.dispatchEvent(new win.MouseEvent('click',{button:0,bubbles:true}));
        await new Promise(r=>win.setTimeout(r,300));
        const starred=tree.view.getCellText(row,{element:cols[6]});
        tree.dispatchEvent(new win.MouseEvent('click',{button:0,bubbles:true}));
        tree.getCellAt=originalHit;
        await new Promise(r=>win.setTimeout(r,300));
        const stored=await IOUtils.readJSON(PathUtils.join(PathUtils.profileDir,'firefox-enhancements-library.json'));
        if(starred!=='★' || stored.entries[url].star!==false || tree.view.getCellText(row,{element:cols[6]})!=='') throw Error('Star persistence failed');
        const nativeDate=win.document.getElementById('placesContentDate');
        const beforeNative=tree.view._result.sortingMode;
        tree.view.cycleHeader(tree.columns.getNamedColumn(nativeDate.id));
        if(beforeNative===tree.view._result.sortingMode) throw Error('Native Last Visit sorting failed');
        tree.view.cycleHeader(tree.columns.getNamedColumn(cols[0].id));
        const domains=Array.from({length:tree.view.rowCount},(_,i)=>tree.view.getCellText(i,{element:cols[0]}));
        const sortedDomains=[...domains].sort((a,b)=>a.localeCompare(b,'pl',{sensitivity:'base',numeric:true}));
        if(cols[0].getAttribute('sortDirection')!=='ascending' || JSON.stringify(domains)!==JSON.stringify(sortedDomains)) throw Error('Domain sorting failed');
        tree.view.cycleHeader(tree.columns.getNamedColumn(cols[6].id));
        if(cols[6].getAttribute('sortDirection')!=='ascending') throw Error('Star sorting failed');
        const file=Services.dirsvc.get('GreD',Ci.nsIFile);file.append('application.ini');
        const fileURL=Services.io.newFileURI(file).spec;
        await PlacesUtils.history.insert({url:fileURL,title:'Close test',visits:[{date:new Date()}]});
        const tab=browser.gBrowser.addTrustedTab(fileURL,{skipAnimation:true});
        await new Promise(r=>win.setTimeout(r,1200));
        browser.gBrowser.removeTab(tab,{animate:false});
        await new Promise(r=>win.setTimeout(r,600));
        const afterClose=await IOUtils.readJSON(PathUtils.join(PathUtils.profileDir,'firefox-enhancements-library.json'));
        if(!afterClose.entries[fileURL]?.closed || afterClose.entries[fileURL]?.lastDuration < 900 || afterClose.entries[fileURL]?.totalDuration < afterClose.entries[fileURL]?.lastDuration) throw Error('Tab close/time not recorded');
        tree.view.cycleHeader(tree.columns.getNamedColumn(cols[4].id));
        tree.view.cycleHeader(tree.columns.getNamedColumn(cols[5].id));
        if(cols[5].getAttribute('sortDirection')!=='ascending') throw Error('Duration sorting failed');
        const errors=Services.console.getMessageArray().filter(x=>x.message.includes('FirefoxEnhancementsLibrary')).map(x=>x.message);
        win.close();
        done({labels:cols.map(x=>x.getAttribute('label')),values,domainNormalizedWithFavicon:true,nativeNameUnchanged:true,starTogglePersisted:true,nativeAndCustomSorting:true,tabCloseAndTimeRecorded:true,errors});
      })().catch(e=>done({error:String(e),stack:e.stack}));
    `,args:[],sandbox:'system',newSandbox:false});
    console.log(JSON.stringify(result));
    assert.deepEqual(result.value.labels,['Domena','Ścieżka','Parametry','Ostatnie zamknięcie karty','Ostatni czas','Łączny czas','Liked']);
    assert.deepEqual(result.value.values,['example.org','folder/page','?q=hello#part','','','','']);
    assert.deepEqual(result.value.errors,[]);
    await command('WebDriver:DeleteSession');socket.end();return;
  }
  console.log(JSON.stringify(await script(`
    try { ChromeUtils.unregisterWindowActor('FirefoxEnhancementsHover'); } catch (_) {}
    Services.io.getProtocolHandler('resource').QueryInterface(Ci.nsIResProtocolHandler).setSubstitution('artllex-shared',Services.io.newFileURI(Services.dirsvc.get('GreD',Ci.nsIFile)));
    ChromeUtils.registerWindowActor('FirefoxEnhancementsHover', {child:{esModuleURI:'resource://artllex-shared/FirefoxEnhancementsHoverChild.sys.mjs'},allFrames:true,safeForUntrustedWebProcess:true});
    return {registered:true};`)));
  await command('Marionette:SetContext', {value: 'content'});
  await command('WebDriver:Navigate',{url:'about:blank'});
  const imageURL=(await script('const c=document.createElement("canvas");c.width=c.height=200;c.getContext("2d").fillRect(0,0,200,200);return c.toDataURL("image/jpeg");')).value;
  await command('WebDriver:Navigate', {url: 'data:text/html,'+encodeURIComponent('<!doctype html><img id="test" src="'+imageURL+'">')});
  await command('WebDriver:PerformActions', {actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,x:60,y:60,origin:'viewport'}]}]});
  await command('Marionette:SetContext', {value: 'chrome'});
  const result=await command('WebDriver:ExecuteAsyncScript',{script:`const done=arguments[arguments.length-1];const win=Services.wm.getMostRecentWindow('navigator:browser');win.gBrowser.selectedBrowser.browsingContext.currentWindowGlobal.getActor('FirefoxEnhancementsHover').sendQuery('GetHoveredImage').then(image=>done({image}),e=>done({error:String(e)}));`,args:[],sandbox:'system',newSandbox:false});
  assert.equal(result.value.image.url,imageURL);
  assert.equal(result.value.image.contentType,'image/jpeg');
  console.log('PASS: Firefox live hover returns JPEG metadata.');
  await command('WebDriver:DeleteSession');
  socket.end();
})().catch(e => { console.error(e); socket.destroy(); process.exitCode=1; });
setTimeout(() => { socket.destroy(); process.exit(2); }, 25000).unref();
