const {PrivateBrowsingUtils}=ChromeUtils.importESModule('resource://gre/modules/PrivateBrowsingUtils.sys.mjs');
const {AsyncShutdown}=ChromeUtils.importESModule('resource://gre/modules/AsyncShutdown.sys.mjs');

const storePath=PathUtils.join(PathUtils.profileDir,'firefox-enhancements-library.json');
const columns=[
  ['closed','Ostatnie zamknięcie karty',260],
  ['lastDuration','Ostatni czas',150],
  ['totalDuration','Łączny czas',150]
];
let entries=Object.create(null),writes=Promise.resolve(),ready,started=false;
const sessions=new Map(),libraryWindows=new Set();

function formatDuration(ms){
  if(!Number.isFinite(ms)) return '';
  const seconds=Math.round(ms/1000),hours=Math.floor(seconds/3600);
  const minutes=Math.floor((seconds%3600)/60),rest=seconds%60;
  return hours?`${hours}:${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`:`${minutes}:${String(rest).padStart(2,'0')}`;
}
function refresh(){for(const win of libraryWindows)win.document.getElementById('placeContent')?.invalidate()}
function save(){writes=writes.catch(()=>{}).then(()=>IOUtils.writeUTF8(storePath,JSON.stringify({version:1,entries}),{tmpPath:storePath+'.tmp'}));refresh()}
function finish(browser,closed=false,now=Date.now()){
  const session=sessions.get(browser);if(!session)return;sessions.delete(browser);
  const duration=Math.max(0,now-session.started),old=entries[session.url]||{};
  entries[session.url]={...old,lastDuration:duration,totalDuration:(old.totalDuration||0)+duration,...(closed?{closed:now}:{})};save();
}
function begin(browser,url,now=Date.now()){finish(browser,false,now);if(/^https?:/.test(url||''))sessions.set(browser,{url,started:now})}
function installBrowser(win){
  if(win.__feLibraryTracking||PrivateBrowsingUtils.isWindowPrivate(win))return;
  win.__feLibraryTracking=true;ready.then(()=>win.gBrowser.browsers.forEach(b=>begin(b,b.currentURI?.spec)));
  const progress={onLocationChange(browser,webProgress,_request,location){if(webProgress?.isTopLevel)ready.then(()=>begin(browser,location?.spec))}};
  win.gBrowser.addTabsProgressListener(progress);
  win.gBrowser.tabContainer.addEventListener('TabClose',event=>ready.then(()=>finish(event.target.linkedBrowser,true)));
  win.addEventListener('unload',()=>{for(const browser of win.gBrowser.browsers)finish(browser,true);try{win.gBrowser.removeTabsProgressListener(progress)}catch(_){}},{once:true});
}
function installLibrary(win){
  const tree=win.document.getElementById('placeContent'),headers=win.document.getElementById('placeContentColumns');
  if(!tree||!headers||win.__feLibraryColumns)return;win.__feLibraryColumns=true;
  const proto=win.PlacesTreeView.prototype,originalText=proto.getCellText,originalCycle=proto.cycleHeader;
  const key=column=>column?.element?.getAttribute('fe-library-column');
  proto.getCellText=function(row,column){
    const field=key(column);if(!field)return originalText.call(this,row,column);
    const entry=entries[this._getNodeForRow(row)?.uri]||{};
    return field==='closed'?(entry.closed?new Date(entry.closed).toLocaleString('pl-PL'):''):formatDuration(entry[field]);
  };
  proto.cycleHeader=function(column){
    const field=key(column);if(!field)return originalCycle.call(this,column);
    const direction=column.element.getAttribute('sortDirection')==='ascending'?'descending':'ascending',factor=direction==='ascending'?1:-1;
    this._rows=Array.from({length:this.rowCount},(_,i)=>this._getNodeForRow(i)).sort((a,b)=>(((entries[a?.uri]||{})[field]||0)-((entries[b?.uri]||{})[field]||0))*factor);
    for(const item of headers.querySelectorAll('[sortDirection]'))item.removeAttribute('sortDirection');
    column.element.setAttribute('sortDirection',direction);this._tree.invalidate();
  };
  const nativeSplitter=headers.querySelector('splitter.tree-splitter');
  function splitter(){const s=nativeSplitter?nativeSplitter.cloneNode(false):win.document.createXULElement('splitter');s.setAttribute('class','tree-splitter');s.setAttribute('resizebefore','sibling');s.setAttribute('resizeafter','sibling');s.setAttribute('orient','horizontal');return s}
  headers.append(splitter());
  for(let index=0;index<columns.length;index++){
    const [field,label,width]=columns[index],id='fe-library-'+field;
    for(const attr of ['width','hidden','ordinal'])try{Services.xulStore.removeValue(win.document.documentURI,id,attr)}catch(_){}
    const column=win.document.createXULElement('treecol');column.id=id;
    column.setAttribute('fe-library-column',field);column.setAttribute('label',label);column.setAttribute('width',width);column.setAttribute('minwidth','60');
    headers.append(column);if(index<columns.length-1)headers.append(splitter());
  }
  headers.style.display='none';headers.getBoundingClientRect();headers.style.display='';
  tree.setAttribute('enableColumnDrag','false');tree.getBoundingClientRect();tree.setAttribute('enableColumnDrag','true');
  [...headers.querySelectorAll('treecol')].forEach((column,index)=>column.setAttribute('ordinal',index));
  headers.getBoundingClientRect();
  tree.invalidate();
  libraryWindows.add(win);win.addEventListener('unload',()=>libraryWindows.delete(win),{once:true});ready.then(refresh);
}
export function start(){
  if(started)return;started=true;
  ready=IOUtils.exists(storePath).then(async exists=>{if(exists)entries=(await IOUtils.readJSON(storePath)).entries||Object.create(null)});
  AsyncShutdown.profileBeforeChange.addBlocker('Firefox Enhancements timing',async()=>{for(const browser of sessions.keys())finish(browser,true);await writes});
  const attach=win=>{try{if(win.document?.documentElement?.getAttribute('windowtype')==='Places:Organizer')installLibrary(win);if(win.gBrowser)installBrowser(win)}catch(error){console.error(error)}};
  Services.obs.addObserver({observe:win=>win.addEventListener('load',()=>attach(win),{once:true})},'domwindowopened');
  Services.obs.addObserver({observe:attach},'browser-delayed-startup-finished');
  for(const win of Services.wm.getEnumerator(null))attach(win);
}
