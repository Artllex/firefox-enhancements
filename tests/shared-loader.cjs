const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const root=process.argv[2];
const files=Object.fromEntries(['artllex.cfg','zipquickextract.cfg','download-router-support.cfg'].filter(n=>fs.existsSync(path.join(root,n))).map(n=>[n,fs.readFileSync(path.join(root,n),'utf8')]));
const active=['zipquickextract-autoconfig.js','download-router-support.js'].filter(n=>fs.existsSync(path.join(root,'defaults/pref',n)));
const errors=[],loaded=[],observers=[];
function file(parts=[]){return {parts,get leafName(){return parts.at(-1)},clone(){return file([...parts])},append(p){parts.push(p)},exists(){return fs.existsSync(path.join(root,...parts))}}}
const context=vm.createContext({Components:{utils:{reportError(e){errors.push(String(e))}}},Ci:{nsIFile:{},nsIResProtocolHandler:{}},ChromeUtils:{},Services:{dirsvc:{get:()=>file()},obs:{addObserver(o,t){observers.push(t)}},io:{newFileURI:()=>({spec:'fixture'}),getProtocolHandler:()=>({QueryInterface:()=>({setSubstitution(){}})})}}});
context.Services.scriptloader={loadSubScript(url){const n=url.split('/').at(-1);loaded.push(n);vm.runInContext(files[n],context)}};
vm.runInContext(files['artllex.cfg'],context);
assert.deepEqual(errors,[]);
assert.equal(loaded.length,active.length,'one load per active module');
assert.equal(observers.length,active.length,'one startup observer per product');
vm.runInContext(files['artllex.cfg'],context);
assert.equal(loaded.length,active.length,'dispatcher must be idempotent');
console.log('PASS shared dispatcher:',active.join(', '));
