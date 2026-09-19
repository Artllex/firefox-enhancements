const {PrivateBrowsingUtils}=ChromeUtils.importESModule('resource://gre/modules/PrivateBrowsingUtils.sys.mjs');
const {AsyncShutdown}=ChromeUtils.importESModule('resource://gre/modules/AsyncShutdown.sys.mjs');

const storePath=PathUtils.join(PathUtils.profileDir,'firefox-enhancements-library.json');
const columns=[
  ['domain','Domena',170],
  ['path','Ścieżka',240],
  ['parameters','Parametry',220],
  ['closed','Ostatnie zamknięcie',260],
  ['lastDuration','Ostatni czas',150],
  ['totalDuration','Łączny czas',150],
  ['star','Liked',80]
];
let entries=Object.create(null),writes=Promise.resolve(),ready,started=false;
const sessions=new Map(),libraryWindows=new Set();

function formatDuration(ms){
  if(!Number.isFinite(ms)) return '';
  const seconds=Math.round(ms/1000),hours=Math.floor(seconds/3600);
  const minutes=Math.floor((seconds%3600)/60),rest=seconds%60;
  return hours?`${hours}:${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`:`${minutes}:${String(rest).padStart(2,'0')}`;
}
function addressParts(uri){try{const url=new URL(uri);if(!['http:','https:','ftp:'].includes(url.protocol))return null;return {domain:url.hostname.replace(/^www\./i,''),path:url.pathname.replace(/^\//,''),parameters:url.search+url.hash}}catch(_){return null}}
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
  const contentView=win.document.getElementById('contentView'),viewsBox=win.document.getElementById('placesViewsBox');
  if(contentView && viewsBox && !win.document.getElementById('fe-library-column-picker')){
    const bar=win.document.createXULElement('hbox');
    bar.id='fe-library-filter-bar';
    bar.setAttribute('align','center');
    bar.style.cssText='padding:8px 12px;border-bottom:1px solid var(--organizer-border-color);';
    const select=win.document.createXULElement('menulist');
    select.id='fe-library-column-picker';
    select.setAttribute('value','title');
    select.setAttribute('label','Nazwa');
    select.style.cssText='min-width:170px;';
    const popup=win.document.createXULElement('menupopup');
    for(const [value,label] of [['title','Nazwa'],['domain','Domena'],['path','Ścieżka'],['parameters','Parametry'],['closed','Ostatnie zamknięcie'],['last','Ostatni czas'],['total','Łączny czas'],['star','Liked'],['tags','Etykiety'],['url','Adres'],['date','Ostatnia wizyta'],['visitCount','Liczba wizyt']]){
      const item=win.document.createXULElement('menuitem');
      item.setAttribute('value',value);item.setAttribute('label',label);
      popup.append(item);
    }
    select.append(popup);
    const input=win.document.createElementNS('http://www.w3.org/1999/xhtml','input');
    input.id='fe-library-filter-value';
    input.setAttribute('type','text');
    input.setAttribute('placeholder','Wartość');
    input.setAttribute('aria-label','Wartość filtra');
    input.style.cssText='display:block;box-sizing:border-box;width:360px;height:32px;margin-inline-start:8px;padding:4px 8px;color:var(--organizer-color);background:var(--organizer-content-background);border:1px solid var(--organizer-border-color);border-radius:4px;';
    const button=win.document.createXULElement('button');
    button.id='fe-library-filter-button';
    button.setAttribute('label','Filtruj');
    button.style.cssText='margin-inline-start:8px;';
    const filter=()=>{
      const tree=win.document.getElementById('placeContent'),view=tree?.view;
      if(!view)return;
      const query=input.value.trim().toLocaleLowerCase('pl-PL');
      if(!view.__feFilterRows||view.__feFilterRoot!==view._rootNode){
        view.__feFilterRows=Array.from({length:view.rowCount},(_,i)=>view._getNodeForRow(i));
        view.__feFilterRoot=view._rootNode;
      }
      const value=(node,field)=>{
        const uri=node?.uri||'',entry=entries[uri]||{},parts=addressParts(uri)||{};
        if(field==='title')return node?.title||'';
        if(field==='url')return uri;
        if(field==='domain'||field==='path'||field==='parameters')return parts[field]||'';
        if(field==='closed')return entry.closed?new Date(entry.closed).toLocaleString('pl-PL'):'';
        if(field==='last')return formatDuration(entry.lastDuration);
        if(field==='total')return formatDuration(entry.totalDuration);
        if(field==='star')return entry.star?'Liked':'';
        if(field==='tags')return node?.tags||'';
        if(field==='date')return node?.time?new Date(node.time/1000).toLocaleString('pl-PL'):'';
        if(field==='visitCount')return String(node?.accessCount??'');
        return '';
      };
      const rows=query?view.__feFilterRows.filter(node=>String(value(node,select.value)).toLocaleLowerCase('pl-PL').includes(query)):view.__feFilterRows.slice();
      const oldCount=view.rowCount;
      view._tree.beginUpdateBatch();
      if(oldCount)view._tree.rowCountChanged(0,-oldCount);
      view._rows=rows;
      if(rows.length)view._tree.rowCountChanged(0,rows.length);
      view._tree.endUpdateBatch();
      view._tree.invalidate();
    };
    button.addEventListener('command',filter);
    input.addEventListener('keydown',event=>{if(event.key==='Enter')filter()});
    bar.append(select,input,button);
    contentView.insertBefore(bar,viewsBox);
  }
  const tree=win.document.getElementById('placeContent'),headers=win.document.getElementById('placeContentColumns');
  if(!tree||!headers||win.__feLibraryColumns)return;win.__feLibraryColumns=true;
  const proto=win.PlacesTreeView.prototype,originalText=proto.getCellText,originalCycle=proto.cycleHeader;
  const key=column=>column?.element?.getAttribute('fe-library-column');
  proto.getCellText=function(row,column){
    const field=key(column);if(!field)return originalText.call(this,row,column);
    const entry=entries[this._getNodeForRow(row)?.uri]||{};
    if(field==='domain'||field==='path'||field==='parameters')return addressParts(this._getNodeForRow(row)?.uri)?.[field]||'';
    if(field==='star')return entry.star?'★':'';
    return field==='closed'?(entry.closed?new Date(entry.closed).toLocaleString('pl-PL'):''):formatDuration(entry[field]);
  };
  const originalImage=proto.getImageSrc;proto.getImageSrc=function(row,column){if(key(column)==='domain'){const title=this._findColumnByType(this.COLUMN_TYPE_TITLE);return title?originalImage.call(this,row,title):''}return originalImage.call(this,row,column)};
  const originalDomainProperties=proto.getCellProperties;proto.getCellProperties=function(row,column){if(key(column)==='domain'){const title=this._findColumnByType(this.COLUMN_TYPE_TITLE);return title?originalDomainProperties.call(this,row,title):''}return originalDomainProperties.call(this,row,column)};
  const style=win.document.createElementNS('http://www.w3.org/1999/xhtml','style');style.textContent='#placeContent treechildren::-moz-tree-cell-text(fe-library-star){font-size:18px;line-height:1;color:#f5b400;font-weight:bold;}';win.document.documentElement.appendChild(style);
  const originalProperties=proto.getCellProperties;proto.getCellProperties=function(row,column){const properties=originalProperties.call(this,row,column),field=key(column);return field==='star'?properties+' fe-library-star':properties};
  proto.cycleHeader=function(column){
    const field=key(column);if(!field)return originalCycle.call(this,column);
    const direction=column.element.getAttribute('sortDirection')==='ascending'?'descending':'ascending',factor=direction==='ascending'?1:-1;
    this._rows=Array.from({length:this.rowCount},(_,i)=>this._getNodeForRow(i)).sort((a,b)=>{const av=field==='domain'||field==='path'||field==='parameters'?(addressParts(a?.uri)?.[field]||''):(field==='star'?((entries[a?.uri]||{}).star?1:0):((entries[a?.uri]||{})[field]||0));const bv=field==='domain'||field==='path'||field==='parameters'?(addressParts(b?.uri)?.[field]||''):(field==='star'?((entries[b?.uri]||{}).star?1:0):((entries[b?.uri]||{})[field]||0));return(typeof av==='string'?av.localeCompare(bv,'pl',{numeric:true,sensitivity:'base'}):av-bv)*factor});
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
    column.setAttribute('fe-library-column',field);column.setAttribute('label',label);column.setAttribute('width',width);column.setAttribute('minwidth','60');if(field==='path'||field==='parameters')column.setAttribute('hidden','true');
    headers.append(column);if(index<columns.length-1)headers.append(splitter());
  }
  headers.style.display='none';headers.getBoundingClientRect();headers.style.display='';
  tree.setAttribute('enableColumnDrag','false');tree.getBoundingClientRect();tree.setAttribute('enableColumnDrag','true');
  [...headers.querySelectorAll('treecol')].forEach((column,index)=>column.setAttribute('ordinal',index));
  headers.getBoundingClientRect();
  tree.invalidate();
  tree.addEventListener('click',event=>{const cell=tree.getCellAt(event.clientX,event.clientY),field=key(cell.col),anonid=cell.col?.element?.getAttribute('anonid'),url=tree.view._getNodeForRow(cell.row)?.uri;if(cell.row<0||!url)return;if(anonid==='title'){const browser=Services.wm.getMostRecentWindow('navigator:browser');browser?.openTrustedLinkIn(url,'tab',{relatedToCurrent:false});event.preventDefault();event.stopImmediatePropagation();return}if(field!=='star'||!addressParts(url))return;entries[url]={...entries[url],star:!entries[url]?.star};save()},{capture:true});
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
