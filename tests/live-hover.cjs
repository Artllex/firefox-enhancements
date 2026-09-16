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
  const module = 'file:///' + path.join(root, 'FirefoxEnhancementsHoverChild.sys.mjs').replaceAll('\\', '/');
  console.log(JSON.stringify(await script(`
    try { ChromeUtils.unregisterWindowActor('FirefoxEnhancementsHover'); } catch (_) {}
    Services.io.getProtocolHandler('resource').QueryInterface(Ci.nsIResProtocolHandler).setSubstitution('artllex-shared',Services.io.newFileURI(Services.dirsvc.get('GreD',Ci.nsIFile)));
    ChromeUtils.registerWindowActor('FirefoxEnhancementsHover', {child:{esModuleURI:'resource://artllex-shared/FirefoxEnhancementsHoverChild.sys.mjs'},allFrames:true,safeForUntrustedWebProcess:true});
    return {registered:true};`, [module])));
  await command('Marionette:SetContext', {value: 'content'});
  await command('WebDriver:Navigate',{url:'about:blank'});
  const imageURL=(await script('const c=document.createElement("canvas");c.width=c.height=200;c.getContext("2d").fillRect(0,0,200,200);return c.toDataURL("image/jpeg");')).value;
  await command('WebDriver:Navigate', {url: 'data:text/html,'+encodeURIComponent('<!doctype html><img id="test" src="'+imageURL+'">')});
  await command('WebDriver:PerformActions', {actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,x:60,y:60,origin:'viewport'}]}]});
  console.log(JSON.stringify(await script('return {hover:[...document.querySelectorAll(":hover")].map(x=>x.localName),width:document.images[0].naturalWidth,hidden:document.hidden};')));
  await command('Marionette:SetContext', {value: 'chrome'});
  const result = await command('WebDriver:ExecuteAsyncScript', {script:`
    const done=arguments[arguments.length-1];
    const win=Services.wm.getMostRecentWindow('navigator:browser');
    win.setTimeout(()=>done({timeout:true,errors:Services.console.getMessageArray().slice(-12).map(x=>x.message)}),5000);
    win.gBrowser.selectedBrowser.browsingContext.currentWindowGlobal.getActor('FirefoxEnhancementsHover').sendQuery('GetHoveredImage').then(x=>done({image:x,hover:win.gBrowser.selectedBrowser.matches(':hover'),focus:win.document.hasFocus()}),e=>done({error:String(e)}));`,args:[],sandbox:'system',newSandbox:false});
  assert.equal(result.value.image.url,imageURL);
  assert.equal(result.value.image.contentType,'image/jpeg');
  const naming=(await script(`
    const win=Services.wm.getMostRecentWindow('navigator:browser');
    const info=new win.FileInfo(null);
    win.initFileInfo(info,'https://example.org/images',null,null,'image/jpeg',null);
    const filters=[];
    win.appendFiltersForContentType({appendFilter:(name,pattern)=>filters.push({name,pattern}),appendFilters:()=>{}},'image/jpeg',info.fileExt,0);
    return {ext:info.fileExt,filters};
  `)).value;
  assert.match(naming.ext,/^jpe?g$/);
  assert.ok(naming.filters.some(x=>/jpe?g/i.test(x.pattern)));
  console.log('PASS: native Firefox filename and file picker filter use JPEG for extensionless /images URL.');
  const cfg=fs.readFileSync(path.join(root,'zipquickextract.cfg'),'utf8');
  const saveFunction=cfg.slice(cfg.indexOf('    async function saveHoveredImage'),cfg.indexOf('    // Failure of this optional feature'));
  async function testSave(expected) {
    const response=await command('WebDriver:ExecuteAsyncScript',{script:`
      const done=arguments[arguments.length-1];
      const win=Services.wm.getMostRecentWindow('navigator:browser');
      const original=win.internalSave; const calls=[]; const errors=[];
      function reportError(e){errors.push(String(e));}
      win.internalSave=(...args)=>calls.push({url:args[0],type:args[5]});
      ${saveFunction}
      saveHoveredImage(win).then(()=>done({calls,errors}),e=>done({error:String(e)})).finally(()=>{win.internalSave=original;});
    `,args:[],sandbox:'system',newSandbox:false});
    assert.deepEqual(response.value,{calls:expected,errors:[]});
  }
  await testSave([{url:imageURL,type:'image/jpeg'}]);
  await command('Marionette:SetContext',{value:'content'});
  await command('WebDriver:PerformActions',{actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,x:350,y:250,origin:'viewport'}]}]});
  await command('Marionette:SetContext',{value:'chrome'});
  await testSave([]);
  console.log('PASS: Firefox live hover without context menu dispatches native save; leaving image dispatches nothing. Save dialog intercepted, not tested.');
  await command('WebDriver:DeleteSession');
  socket.end();
})().catch(e => { console.error(e); socket.destroy(); process.exitCode=1; });
setTimeout(() => { socket.destroy(); process.exit(2); }, 25000).unref();
