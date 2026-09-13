const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert');
const files={
 'zipquickextract.cfg':fs.readFileSync(path.join(__dirname,'../zipquickextract.cfg'),'utf8'),
 'download-router-support.cfg':fs.readFileSync(process.argv[3] || path.join(process.argv[2], 'support/firefox/download-router-support.cfg'),'utf8')
};
for(const first of Object.keys(files))for(const both of [true,false]){
 const loaded=[],observers=[],errors=[];
 const prefs=both?['zipquickextract-autoconfig.js','download-router-support.js']:[first==='zipquickextract.cfg'?'zipquickextract-autoconfig.js':'download-router-support.js'];
 function file(){return {parts:[],get leafName(){return this.parts.at(-1)},append(p){this.parts.push(p)},exists(){return this.parts.length===1?!!files[this.parts[0]]:prefs.includes(this.parts.at(-1))}}}
 const context=vm.createContext({Components:{utils:{reportError(e){errors.push(e)}}},Ci:{nsIFile:{},nsIResProtocolHandler:{}},ChromeUtils:{},Services:{dirsvc:{get:file},obs:{addObserver(o,t){observers.push(t)}},io:{newFileURI(f){return {spec:f.parts.at(-1)}},getProtocolHandler(){return {QueryInterface(){return {setSubstitution(){}}}}}}}});
 context.Services.scriptloader={loadSubScript(url,target){loaded.push(url);vm.runInContext(files[url.split('/').at(-1)],context)}};
 vm.runInContext(files[first],context);
 assert.equal(errors.length,0,String(errors));
 assert.equal(observers.length,both?2:1);
 assert.equal(loaded.length,both?2:0);
 vm.runInContext(files[first],context);
 assert.equal(observers.length,both?2:1,'duplicate startup');
 console.log('PASS',first,both?'both products':'standalone / peer disabled');
}
