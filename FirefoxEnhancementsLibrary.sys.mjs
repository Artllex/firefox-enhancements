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
const libraryUiEnabled=true;
const sessions=new Map(),libraryWindows=new Set();

function formatDuration(ms){
  if(!Number.isFinite(ms)) return '';
  const seconds=Math.round(ms/1000),hours=Math.floor(seconds/3600);
  const minutes=Math.floor((seconds%3600)/60),rest=seconds%60;
  return hours?`${hours}:${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`:`${minutes}:${String(rest).padStart(2,'0')}`;
}
function parseDuration(text){
  const value=String(text).trim().toLocaleLowerCase('pl-PL').replace(/,/g,'.');
  if(!value)return NaN;
  if(/^\d+(?::\d{1,2}){1,2}$/.test(value)){
    const parts=value.split(':').map(Number);let seconds=0;
    for(const part of parts)seconds=seconds*60+part;
    return seconds*1000;
  }
  let seconds=0,matched='',match;
  const pattern=/(\d+(?:\.\d+)?)\s*(h|godz(?:\.|iny|ina)?|min(?:\.|uty|uta)?|m|s|sek(?:\.|undy|unda)?)/g;
  while((match=pattern.exec(value))){matched+=match[0];const amount=Number(match[1]),unit=match[2];seconds+=amount*(unit==='h'||unit.startsWith('godz')?3600:unit==='m'||unit.startsWith('min')?60:1)}
  return matched&&value.replace(pattern,'').trim()===''?seconds*1000:NaN;
}
function parseLiked(text){
  const value=String(text).trim().toLocaleLowerCase('pl-PL');
  if(['tak','yes','1','liked','★','gwiazdka','oznaczone'].includes(value))return true;
  if(['nie','no','0','unliked','brak','bez gwiazdki','nieoznaczone'].includes(value))return false;
  return null;
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
function installLibraryRowHeight(win){
  const tree=win.document.getElementById('placeContent'),viewPopup=win.document.getElementById('viewMenuPopup');
  if(!tree||!viewPopup||win.document.getElementById('fe-library-row-height-menu'))return;
  const style=win.document.createElementNS('http://www.w3.org/1999/xhtml','style');
  style.id='fe-library-row-height-style';
  style.textContent='#placeContent treechildren::-moz-tree-row{height:var(--fe-library-row-height,28px)!important}#placeContent treechildren::-moz-tree-cell-text{padding-block:2px!important}';
  win.document.documentElement.append(style);
  const menu=win.document.createXULElement('menu');menu.id='fe-library-row-height-menu';menu.setAttribute('label','Wysokość wierszy');
  const popup=win.document.createXULElement('menupopup'),items=[];
  const setHeight=value=>{tree.style.setProperty('--fe-library-row-height',value+'px');for(const item of items)item.toggleAttribute('checked',item.getAttribute('value')===String(value));tree.invalidate()};
  for(const [value,label] of [[28,'Standardowa'],[42,'Rozszerzona'],[64,'Duża']]){const item=win.document.createXULElement('menuitem');item.setAttribute('type','radio');item.setAttribute('name','fe-library-row-height');item.setAttribute('value',value);item.setAttribute('label',label);if(value===28)item.setAttribute('checked','true');item.addEventListener('command',()=>setHeight(value));items.push(item);popup.append(item)}
  menu.append(popup);viewPopup.append(menu);
}

function installLibraryColumns(win){
  const tree=win.document.getElementById('placeContent'),headers=win.document.getElementById('placeContentColumns');
  if(!tree||!headers||win.__feLibraryColumns)return;
  win.__feLibraryColumns=true;
  const nativeSplitter=headers.querySelector('splitter.tree-splitter');
  const splitter=()=>{const item=nativeSplitter?nativeSplitter.cloneNode(false):win.document.createXULElement('splitter');item.setAttribute('class','tree-splitter');item.setAttribute('resizebefore','sibling');item.setAttribute('resizeafter','sibling');item.setAttribute('orient','horizontal');return item};
  for(const [field,label,width] of columns){
    const column=win.document.createXULElement('treecol');
    column.id='fe-library-'+field;column.setAttribute('fe-library-column',field);column.setAttribute('label',label);column.setAttribute('width',width);column.setAttribute('minwidth','60');
    if(field==='path'||field==='parameters')column.setAttribute('hidden','true');
    headers.append(splitter(),column);
  }
  const proto=win.PlacesTreeView.prototype,originalText=proto.getCellText,originalImage=proto.getImageSrc,originalProperties=proto.getCellProperties;
  const fieldFor=column=>column?.element?.getAttribute('fe-library-column');
  proto.getCellText=function(row,column){const field=fieldFor(column);if(!field)return originalText.call(this,row,column);const node=this._getNodeForRow(row),entry=entries[node?.uri]||{};if(field==='domain'||field==='path'||field==='parameters')return addressParts(node?.uri)?.[field]||'';if(field==='star')return entry.star?'★':'';return field==='closed'?(entry.closed?new Date(entry.closed).toLocaleString('pl-PL'):''):formatDuration(entry[field])};
  proto.getImageSrc=function(row,column){if(fieldFor(column)==='domain'){const title=this._findColumnByType(this.COLUMN_TYPE_TITLE);return title?originalImage.call(this,row,title):''}return originalImage.call(this,row,column)};
  proto.getCellProperties=function(row,column){if(fieldFor(column)==='domain'){const title=this._findColumnByType(this.COLUMN_TYPE_TITLE);return title?originalProperties.call(this,row,title):''}return originalProperties.call(this,row,column)};
  tree.addEventListener('click',async event=>{if(event.button!==0)return;const cell=tree.getCellAt(event.clientX,event.clientY),clickedField=fieldFor(cell.col),anonid=cell.col?.element?.getAttribute('anonid'),url=tree.view?._getNodeForRow(cell.row)?.uri;if(cell.row<0||!url)return;if(anonid==='title'){const browser=Services.wm.getMostRecentWindow('navigator:browser');browser?.openTrustedLinkIn(url,'tab',{relatedToCurrent:false});event.preventDefault();event.stopImmediatePropagation();return}if(clickedField!=='star'||!addressParts(url))return;event.preventDefault();event.stopImmediatePropagation();await ready;entries[url]={...entries[url],star:!entries[url]?.star};save()},true);
  tree.addEventListener('dblclick',event=>{const cell=tree.getCellAt(event.clientX,event.clientY),anonid=cell.col?.element?.getAttribute('anonid');if(anonid==='title'||fieldFor(cell.col)==='star'){event.preventDefault();event.stopImmediatePropagation()}},true);
  tree.invalidate();
}

function installLibraryFilters(win){
  const contentView=win.document.getElementById('contentView'),viewsBox=win.document.getElementById('placesViewsBox'),tree=win.document.getElementById('placeContent');
  if(!contentView||!viewsBox||!tree||win.document.getElementById('fe-library-filter-bar'))return;
  const bar=win.document.createXULElement('hbox');bar.id='fe-library-filter-bar';bar.setAttribute('align','center');bar.style.cssText='padding:8px 12px;border-bottom:1px solid var(--organizer-border-color);';
  const field=win.document.createXULElement('menulist');field.setAttribute('value','title');field.setAttribute('label','Nazwa');field.style.cssText='min-width:170px;';
  const fieldPopup=win.document.createXULElement('menupopup');
  for(const [value,label] of [['title','Nazwa'],['domain','Domena'],['path','Ścieżka'],['parameters','Parametry'],['closed','Ostatnie zamknięcie'],['last','Ostatni czas'],['total','Łączny czas'],['star','Liked'],['tags','Etykiety'],['url','Adres'],['date','Ostatnia wizyta'],['visitCount','Liczba wizyt']]){const item=win.document.createXULElement('menuitem');item.setAttribute('value',value);item.setAttribute('label',label);fieldPopup.append(item)}
  field.append(fieldPopup);
  const operator=win.document.createXULElement('menulist');operator.setAttribute('value','contains');operator.setAttribute('label','zawiera');operator.style.cssText='min-width:120px;margin-inline-start:8px;';
  const operatorPopup=win.document.createXULElement('menupopup');
  for(const [value,label] of [['contains','zawiera'],['notContains','nie zawiera'],['eq','='],['ne','≠'],['gt','>'],['ge','≥'],['lt','<'],['le','≤']]){const item=win.document.createXULElement('menuitem');item.setAttribute('value',value);item.setAttribute('label',label);operatorPopup.append(item)}
  operator.append(operatorPopup);
  const input=win.document.createElementNS('http://www.w3.org/1999/xhtml','input');input.setAttribute('type','text');input.setAttribute('placeholder','Wartość');input.setAttribute('aria-label','Wartość filtra');input.style.cssText='appearance:none!important;-moz-appearance:none!important;display:block;box-sizing:border-box;width:360px;height:24px!important;min-height:24px!important;max-height:24px!important;line-height:22px!important;margin-inline-start:8px;padding:0 8px!important;color:var(--organizer-color);background:var(--organizer-content-background);border:1px solid var(--organizer-border-color);border-radius:4px;font:inherit;';
  const button=win.document.createXULElement('button');button.setAttribute('label','Filtruj');button.style.cssText='margin-inline-start:8px;';
  const writeRows=rows=>{const view=tree.view;if(!view)return;const oldCount=view.rowCount;view._tree.beginUpdateBatch();if(oldCount)view._tree.rowCountChanged(0,-oldCount);view._rows=rows;if(rows.length)view._tree.rowCountChanged(0,rows.length);view._tree.endUpdateBatch();view._tree.invalidate()};
  const apply=()=>{const view=tree.view;if(!view)return;const query=input.value.trim(),queryLower=query.toLocaleLowerCase('pl-PL');if(!view.__feFilterRows||view.__feFilterRoot!==view._rootNode){view.__feFilterRows=Array.from({length:view.rowCount},(_,index)=>view._getNodeForRow(index));view.__feFilterRoot=view._rootNode}const value=(node,name,raw=false)=>{const uri=node?.uri||'',entry=entries[uri]||{},parts=addressParts(uri)||{};if(name==='title')return node?.title||'';if(name==='url')return uri;if(name==='domain'||name==='path'||name==='parameters')return parts[name]||'';if(name==='closed')return raw?(entry.closed||NaN):(entry.closed?new Date(entry.closed).toLocaleString('pl-PL'):'');if(name==='last')return raw?entry.lastDuration:formatDuration(entry.lastDuration);if(name==='total')return raw?entry.totalDuration:formatDuration(entry.totalDuration);if(name==='star')return raw?!!entry.star:(entry.star?'Liked':'');if(name==='tags')return node?.tags||'';if(name==='date')return raw?(node?.time?node.time/1000:NaN):(node?.time?new Date(node.time/1000).toLocaleString('pl-PL'):'');if(name==='visitCount')return raw?Number(node?.accessCount):String(node?.accessCount??'');return ''};const numeric=new Set(['last','total','visitCount','closed','date']),name=field.value,operation=operator.value;let expected=queryLower;if(name==='last'||name==='total')expected=parseDuration(query);else if(name==='visitCount')expected=Number(query.replace(',','.'));else if(name==='closed'||name==='date')expected=Date.parse(query);else if(name==='star')expected=parseLiked(query);const matches=node=>{const display=String(value(node,name)).toLocaleLowerCase('pl-PL');if(name==='star'&&(operation==='eq'||operation==='ne'))return expected===null?false:(operation==='eq'?value(node,name,true)===expected:value(node,name,true)!==expected);if(operation==='contains')return display.includes(queryLower);if(operation==='notContains')return !display.includes(queryLower);const actual=numeric.has(name)?Number(value(node,name,true)):display;if(numeric.has(name)&&(!Number.isFinite(actual)||!Number.isFinite(expected)))return false;if(operation==='eq')return actual===expected;if(operation==='ne')return actual!==expected;if(operation==='gt')return actual>expected;if(operation==='ge')return actual>=expected;if(operation==='lt')return actual<expected;if(operation==='le')return actual<=expected;return false};writeRows(query?view.__feFilterRows.filter(matches):view.__feFilterRows.slice())};
  field.addEventListener('command',()=>{const numeric=['last','total','visitCount','closed','date'].includes(field.value);if(field.value==='star'){operator.value='eq';operator.setAttribute('label','=')}else if(numeric&&['contains','notContains'].includes(operator.value)){operator.value='ge';operator.setAttribute('label','≥')}else if(!numeric&&!['contains','notContains','eq','ne'].includes(operator.value)){operator.value='contains';operator.setAttribute('label','zawiera')}input.placeholder=field.value==='last'||field.value==='total'?'np. 3h 40min 10s':field.value==='visitCount'?'Liczba':field.value==='star'?'yes / no (★)':'Wartość'});
  button.addEventListener('command',apply);input.addEventListener('keydown',event=>{if(event.key==='Enter')apply()});
  win.document.getElementById('placesList')?.addEventListener('select',()=>{win.setTimeout(()=>{if(!tree.view)return;delete tree.view.__feFilterRows;delete tree.view.__feFilterRoot;apply()},0);win.setTimeout(()=>{if(!tree.view)return;delete tree.view.__feFilterRows;delete tree.view.__feFilterRoot;apply()},100)});
  bar.append(field,operator,input,button);contentView.insertBefore(bar,viewsBox);
}

function installLibrary(win){
  installLibraryRowHeight(win);
  installLibraryColumns(win);
  installLibraryFilters(win);
  return;
  if(!libraryUiEnabled)return;
  {
    const gridTree=win.document.getElementById('placeContent'),gridBox=win.document.getElementById('placesViewsBox'),viewPopup=win.document.getElementById('viewMenuPopup');
    if(!gridTree||!gridBox||!viewPopup||win.document.getElementById('fe-library-grid-only'))return;
    const grid=win.document.createElementNS('http://www.w3.org/1999/xhtml','div');
    grid.id='fe-library-grid-only';grid.hidden=true;
    grid.style.cssText='display:grid;flex:1;min-height:0;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:14px;padding:14px;overflow:auto;background:var(--organizer-content-background);';
    const style=win.document.createElementNS('http://www.w3.org/1999/xhtml','style');
    style.id='fe-library-grid-only-style';
    style.textContent='#fe-library-grid-only .fe-card{overflow:hidden;border:1px solid var(--organizer-border-color);border-radius:8px;background:var(--organizer-toolbar-background);color:var(--organizer-color)}#fe-library-grid-only .fe-preview{height:130px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--organizer-toolbar-background) 70%,black)}#fe-library-grid-only .fe-preview img{max-width:64px;max-height:64px;object-fit:contain}#fe-library-grid-only .fe-body{padding:10px 12px 12px}#fe-library-grid-only .fe-title{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#fe-library-grid-only .fe-date{margin-top:6px;font-size:.9em;opacity:.75}';
    win.document.documentElement.append(style);gridBox.append(grid);
    const render=()=>{if(grid.hidden)return;const rows=Array.from(gridTree.view?._rows||[]);grid.replaceChildren();for(const node of rows){if(!node?.uri)continue;const card=win.document.createElementNS('http://www.w3.org/1999/xhtml','article');card.className='fe-card';const preview=win.document.createElementNS('http://www.w3.org/1999/xhtml','div');preview.className='fe-preview';if(node.icon){const icon=win.document.createElementNS('http://www.w3.org/1999/xhtml','img');icon.src=node.icon;preview.append(icon)}const body=win.document.createElementNS('http://www.w3.org/1999/xhtml','div');body.className='fe-body';const title=win.document.createElementNS('http://www.w3.org/1999/xhtml','div');title.className='fe-title';title.textContent=node.title||node.uri;const date=win.document.createElementNS('http://www.w3.org/1999/xhtml','div');date.className='fe-date';date.textContent=node.time?new Date(node.time/1000).toLocaleString('pl-PL'):'Brak daty wizyty';body.append(title,date);card.append(preview,body);grid.append(card)}};
    const item=win.document.createXULElement('menuitem');item.id='fe-library-grid-only-toggle';item.setAttribute('type','checkbox');item.setAttribute('label','Widok siatki');item.addEventListener('command',()=>{const enabled=grid.hidden;item.toggleAttribute('checked',enabled);gridTree.hidden=enabled;grid.hidden=!enabled;grid.style.display=enabled?'grid':'none';if(enabled)render()});viewPopup.append(item);
    win.document.getElementById('placesList')?.addEventListener('select',()=>win.setTimeout(render,0));
    return;
  }
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
    const operator=win.document.createXULElement('menulist');
    operator.id='fe-library-filter-operator';
    operator.setAttribute('value','contains');
    operator.setAttribute('label','zawiera');
    operator.style.cssText='min-width:120px;margin-inline-start:8px;';
    const operatorPopup=win.document.createXULElement('menupopup');
    for(const [value,label] of [['contains','zawiera'],['notContains','nie zawiera'],['eq','='],['ne','≠'],['gt','>'],['ge','≥'],['lt','<'],['le','≤']]){
      const item=win.document.createXULElement('menuitem');item.setAttribute('value',value);item.setAttribute('label',label);operatorPopup.append(item);
    }
    operator.append(operatorPopup);
    const input=win.document.createElementNS('http://www.w3.org/1999/xhtml','input');
    input.id='fe-library-filter-value';
    input.setAttribute('type','text');
    input.setAttribute('placeholder','Wartość');
    input.setAttribute('aria-label','Wartość filtra');
    input.style.cssText='appearance:none!important;-moz-appearance:none!important;display:block;box-sizing:border-box;width:360px;height:24px!important;min-height:24px!important;max-height:24px!important;line-height:22px!important;margin-inline-start:8px;padding:0 8px!important;color:var(--organizer-color);background:var(--organizer-content-background);border:1px solid var(--organizer-border-color);border-radius:4px;font:inherit;';
    const button=win.document.createXULElement('button');
    button.id='fe-library-filter-button';
    button.setAttribute('label','Filtruj');
    button.style.cssText='margin-inline-start:8px;';
    const filter=()=>{
      const tree=win.document.getElementById('placeContent'),view=tree?.view;
      if(!view)return;
      const query=input.value.trim(),normalizedQuery=query.toLocaleLowerCase('pl-PL');
      if(!view.__feFilterRows||view.__feFilterRoot!==view._rootNode){
        view.__feFilterRows=Array.from({length:view.rowCount},(_,i)=>view._getNodeForRow(i));
        view.__feFilterRoot=view._rootNode;
      }
      const value=(node,field,raw=false)=>{
        const uri=node?.uri||'',entry=entries[uri]||{},parts=addressParts(uri)||{};
        if(field==='title')return node?.title||'';
        if(field==='url')return uri;
        if(field==='domain'||field==='path'||field==='parameters')return parts[field]||'';
        if(field==='closed')return raw?(entry.closed||NaN):(entry.closed?new Date(entry.closed).toLocaleString('pl-PL'):'');
        if(field==='last')return raw?entry.lastDuration:formatDuration(entry.lastDuration);
        if(field==='total')return raw?entry.totalDuration:formatDuration(entry.totalDuration);
        if(field==='star')return raw?!!entry.star:(entry.star?'Liked':'');
        if(field==='tags')return node?.tags||'';
        if(field==='date')return raw?(node?.time?node.time/1000:NaN):(node?.time?new Date(node.time/1000).toLocaleString('pl-PL'):'');
        if(field==='visitCount')return raw?Number(node?.accessCount):String(node?.accessCount??'');
        return '';
      };
      const numericFields=new Set(['last','total','visitCount','closed','date']),field=select.value,operation=operator.value;
      let expected=normalizedQuery;
      if(field==='last'||field==='total')expected=parseDuration(query);
      else if(field==='visitCount')expected=Number(query.replace(',','.'));
      else if(field==='closed'||field==='date')expected=Date.parse(query);
      else if(field==='star')expected=parseLiked(query);
      const matches=node=>{
        const display=String(value(node,field)).toLocaleLowerCase('pl-PL');
        if(field==='star'&&(operation==='eq'||operation==='ne')){
          if(expected===null)return false;
          return operation==='eq'?value(node,field,true)===expected:value(node,field,true)!==expected;
        }
        if(operation==='contains')return display.includes(normalizedQuery);
        if(operation==='notContains')return !display.includes(normalizedQuery);
        const actual=numericFields.has(field)?Number(value(node,field,true)):display;
        if(numericFields.has(field)&&(!Number.isFinite(actual)||!Number.isFinite(expected)))return false;
        if(operation==='eq')return actual===expected;
        if(operation==='ne')return actual!==expected;
        if(operation==='gt')return actual>expected;
        if(operation==='ge')return actual>=expected;
        if(operation==='lt')return actual<expected;
        if(operation==='le')return actual<=expected;
        return false;
      };
      const rows=query?view.__feFilterRows.filter(matches):view.__feFilterRows.slice();
      if(!grid.hidden){win.__feRenderLibraryGrid?.(rows);return}
      const oldCount=view.rowCount;
      view._tree.beginUpdateBatch();
      if(oldCount)view._tree.rowCountChanged(0,-oldCount);
      view._rows=rows;
      if(rows.length)view._tree.rowCountChanged(0,rows.length);
      view._tree.endUpdateBatch();
      view._tree.invalidate();
      if(!grid.hidden)win.__feRenderLibraryGrid?.();
    };
    button.addEventListener('command',filter);
    input.addEventListener('keydown',event=>{if(event.key==='Enter')filter()});
    win.__feApplyLibraryFilter=filter;
    select.addEventListener('command',()=>{
      const numeric=['last','total','visitCount','closed','date'].includes(select.value);
      if(select.value==='star'){operator.value='eq';operator.setAttribute('label','=')}
      if(numeric&&['contains','notContains'].includes(operator.value)){operator.value='ge';operator.setAttribute('label','≥')}
      if(!numeric&&!['contains','notContains','eq','ne'].includes(operator.value)){operator.value='contains';operator.setAttribute('label','zawiera')}
      input.placeholder=select.value==='last'||select.value==='total'?'np. 3h 40min 10s':select.value==='visitCount'?'Liczba':select.value==='star'?'yes / no (★)':'Wartość';
    });
    bar.append(select,operator,input,button);
    contentView.insertBefore(bar,viewsBox);
  }
  const tree=win.document.getElementById('placeContent'),headers=win.document.getElementById('placeContentColumns');
  if(!tree||!headers||win.__feLibraryColumns)return;win.__feLibraryColumns=true;
  const grid=win.document.createElementNS('http://www.w3.org/1999/xhtml','div');
  grid.id='fe-library-grid';grid.hidden=true;
  grid.style.cssText='display:grid;flex:1;min-height:0;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));grid-auto-rows:max-content;gap:14px;padding:14px;overflow:auto;background:var(--organizer-content-background);';
  win.document.getElementById('placesViewsBox')?.append(grid);
  const gridStyle=win.document.createElementNS('http://www.w3.org/1999/xhtml','style');
  gridStyle.textContent='#fe-library-grid .fe-library-card{position:relative;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--organizer-border-color);border-radius:8px;background:var(--organizer-toolbar-background);color:var(--organizer-color)}#fe-library-grid .fe-library-card:hover{background:var(--organizer-hover-background)}#fe-library-grid .fe-library-card.selected{outline:4px solid #42b8ff;outline-offset:2px;box-shadow:0 0 0 2px rgba(66,184,255,.25),0 0 14px rgba(66,184,255,.65)}#fe-library-grid .fe-library-card.active{outline-color:#73d0ff}.fe-library-card-preview{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;background:color-mix(in srgb,var(--organizer-toolbar-background) 75%,black);cursor:pointer}.fe-library-card-preview>img{width:100%;height:100%;display:block;object-fit:cover}.fe-library-card-fallback{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}.fe-library-card-fallback img{width:48px;height:48px;object-fit:contain}.fe-library-card-body{padding:10px 12px 12px;cursor:default}.fe-library-card-title{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fe-library-card-date{opacity:.75;font-size:.9em;margin-top:6px}.fe-library-card-liked{position:absolute;z-index:3;top:6px;right:6px;width:30px;height:30px;padding:0;border:0;border-radius:50%;background:color-mix(in srgb,var(--organizer-toolbar-background) 82%,transparent);color:#f5b400;font-size:21px;line-height:30px;opacity:0;cursor:pointer}.fe-library-card:hover .fe-library-card-liked,.fe-library-card-liked.liked{opacity:1}';
  win.document.documentElement.append(gridStyle);
  let gridRows=[],selectedCards=new Set(),activeCard=-1,selectionAnchor=-1;
  const updateGridSelection=()=>{[...grid.children].forEach((card,index)=>{card.classList.toggle('selected',selectedCards.has(index));card.classList.toggle('active',index===activeCard)})};
  const selectGridCard=(index,extend=false,toggle=false)=>{if(index<0||index>=gridRows.length)return;if(extend&&selectionAnchor>=0){selectedCards.clear();for(let i=Math.min(selectionAnchor,index);i<=Math.max(selectionAnchor,index);i++)selectedCards.add(i)}else if(toggle){selectedCards.has(index)?selectedCards.delete(index):selectedCards.add(index);selectionAnchor=index}else{selectedCards=new Set([index]);selectionAnchor=index}activeCard=index;updateGridSelection();grid.children[index]?.scrollIntoView({block:'nearest',inline:'nearest'});grid.focus()};
  const selectedGridNodes=()=>[...selectedCards].sort((a,b)=>a-b).map(index=>gridRows[index]).filter(node=>node?.uri);
  const deleteSelectedGridCards=()=>{const nodes=selectedGridNodes();if(!nodes.length)return;const urls=[...new Set(nodes.map(node=>node.uri))];return Promise.resolve(PlacesUtils.history.remove(urls)).then(()=>{for(const url of urls)delete entries[url];save();renderGrid(gridRows.filter(node=>!urls.includes(node.uri)))}).catch(error=>console.error('Firefox Enhancements: history removal failed',error))};
  const setSelectedGridLiked=liked=>{const nodes=selectedGridNodes();for(const node of nodes)entries[node.uri]={...entries[node.uri],star:liked};save();renderGrid(gridRows)};
  const renderGrid=(rows=tree.view?._rows||[])=>{gridRows=Array.from(rows);selectedCards.clear();activeCard=-1;selectionAnchor=-1;grid.replaceChildren();let PageThumbs=null;try{PageThumbs=ChromeUtils.importESModule('resource://gre/modules/PageThumbs.sys.mjs').PageThumbs}catch(_){}for(const [index,node] of gridRows.entries()){const card=win.document.createElementNS('http://www.w3.org/1999/xhtml','div');card.className='fe-library-card';const preview=win.document.createElementNS('http://www.w3.org/1999/xhtml','div');preview.className='fe-library-card-preview';preview.setAttribute('title','Otwórz w nowej karcie');const fallback=win.document.createElementNS('http://www.w3.org/1999/xhtml','div');fallback.className='fe-library-card-fallback';if(node.icon){const favicon=win.document.createElementNS('http://www.w3.org/1999/xhtml','img');favicon.src=node.icon;fallback.append(favicon)}preview.append(fallback);if(PageThumbs&&node.uri){const shot=win.document.createElementNS('http://www.w3.org/1999/xhtml','img');shot.src=PageThumbs.getThumbnailURL(node.uri);shot.addEventListener('load',()=>fallback.hidden=true);shot.addEventListener('error',()=>shot.remove());preview.append(shot)}preview.addEventListener('click',event=>{event.stopPropagation();const browser=Services.wm.getMostRecentWindow('navigator:browser');if(node.uri)browser?.openTrustedLinkIn(node.uri,'tab',{relatedToCurrent:false})});const liked=win.document.createElementNS('http://www.w3.org/1999/xhtml','button');liked.className='fe-library-card-liked'+(entries[node.uri]?.star?' liked':'');liked.textContent=entries[node.uri]?.star?'★':'☆';liked.setAttribute('title','Liked');liked.addEventListener('click',event=>{event.stopPropagation();entries[node.uri]={...entries[node.uri],star:!entries[node.uri]?.star};liked.classList.toggle('liked',!!entries[node.uri].star);liked.textContent=entries[node.uri].star?'★':'☆';save()});const body=win.document.createElementNS('http://www.w3.org/1999/xhtml','div');body.className='fe-library-card-body';const title=win.document.createElementNS('http://www.w3.org/1999/xhtml','div');title.className='fe-library-card-title';title.textContent=node.title||node.uri||'';const date=win.document.createElementNS('http://www.w3.org/1999/xhtml','div');date.className='fe-library-card-date';const closed=entries[node.uri]?.closed;date.textContent=closed?new Date(closed).toLocaleString('pl-PL'):'Brak daty zamknięcia';body.append(title,date);body.addEventListener('click',event=>selectGridCard(index,event.shiftKey,event.ctrlKey));card.addEventListener('contextmenu',event=>{event.preventDefault();event.stopPropagation();if(!selectedCards.has(index))selectGridCard(index,false,false);openGridContextMenu(event.screenX,event.screenY,index)});card.append(preview,liked,body);grid.append(card)}};
  grid.tabIndex=0;
  const handleGridKey=event=>{if(grid.hidden||!gridRows.length)return;if(event.target?.localName==='input'||event.target?.localName==='textarea')return;const first=grid.querySelector('.fe-library-card'),width=first?.getBoundingClientRect().width||1,gap=parseFloat(win.getComputedStyle(grid).columnGap)||0,columns=Math.max(1,Math.floor((grid.clientWidth+gap)/(width+gap)));let next=activeCard<0?0:activeCard;if(event.key==='ArrowLeft')next--;else if(event.key==='ArrowRight')next++;else if(event.key==='ArrowUp')next-=columns;else if(event.key==='ArrowDown')next+=columns;else if(event.key==='Delete'){if(!selectedCards.size)return;event.preventDefault();event.stopPropagation();deleteSelectedGridCards();return}else return;event.preventDefault();event.stopPropagation();selectGridCard(Math.max(0,Math.min(gridRows.length-1,next)),event.shiftKey,false)};
  win.addEventListener('keydown',handleGridKey,true);
  const gridContextMenu=win.document.createXULElement('menupopup');gridContextMenu.id='fe-library-grid-context';
  const deleteContextItem=win.document.createXULElement('menuitem');deleteContextItem.setAttribute('label','Usuń z historii');deleteContextItem.addEventListener('command',deleteSelectedGridCards);
  const likedContextItem=win.document.createXULElement('menuitem');let contextLikedAction=true;likedContextItem.addEventListener('command',()=>setSelectedGridLiked(contextLikedAction));
  gridContextMenu.append(deleteContextItem,likedContextItem);win.document.getElementById('placesPopupset')?.append(gridContextMenu);
  const openGridContextMenu=(screenX,screenY,index)=>{contextLikedAction=!entries[gridRows[index]?.uri]?.star;likedContextItem.setAttribute('label',contextLikedAction?'Dodaj do Liked':'Usuń z Liked');gridContextMenu.openPopupAtScreen(screenX,screenY,true)};
  const viewPopup=win.document.getElementById('viewMenuPopup');
  if(viewPopup&&!win.document.getElementById('fe-library-grid-view')){
    const menu=win.document.createXULElement('menu');menu.id='fe-library-grid-view';menu.setAttribute('label','Widok siatki');
    const popup=win.document.createXULElement('menupopup'),items=[];
    const setGridMode=mode=>{for(const item of items){if(item.getAttribute('value')===mode)item.setAttribute('checked','true');else item.removeAttribute('checked')}const enabled=mode!=='off';tree.hidden=enabled;grid.hidden=!enabled;grid.style.display=enabled?'grid':'none';grid.style.gridTemplateColumns=mode==='small'?'repeat(auto-fill,minmax(130px,1fr))':'repeat(auto-fill,minmax(260px,1fr))';grid.dataset.size=mode;if(enabled)renderGrid()};
    for(const [value,label] of [['off','Wyłączony'],['large','Duży'],['small','Mały']]){const item=win.document.createXULElement('menuitem');item.setAttribute('type','radio');item.setAttribute('name','fe-library-grid-size');item.setAttribute('value',value);item.setAttribute('label',label);if(value==='off')item.setAttribute('checked','true');item.addEventListener('command',()=>setGridMode(value));items.push(item);popup.append(item)}
    menu.append(popup);viewPopup.append(menu);
  }
  win.__feRenderLibraryGrid=renderGrid;
  const placesList=win.document.getElementById('placesList');
  placesList?.addEventListener('select',()=>{
    const refreshGrid=()=>{if(grid.hidden)return;const view=tree.view;if(view){delete view.__feFilterRows;delete view.__feFilterRoot}const value=win.document.getElementById('fe-library-filter-value')?.value||'';value?win.__feApplyLibraryFilter?.():renderGrid()};
    win.setTimeout(refreshGrid,0);win.setTimeout(refreshGrid,100);
  });
  const proto=win.PlacesTreeView.prototype,originalText=proto.getCellText,originalCycle=proto.cycleHeader;
  const resultDescriptor=Object.getOwnPropertyDescriptor(proto,'result');
  if(resultDescriptor?.get&&resultDescriptor?.set){Object.defineProperty(proto,'result',{configurable:true,enumerable:resultDescriptor.enumerable,get:resultDescriptor.get,set(value){resultDescriptor.set.call(this,value);if(this._element?.id!=='placeContent')return;win.setTimeout(()=>{delete this.__feFilterRows;delete this.__feFilterRoot;if(grid.hidden)return;const filterValue=win.document.getElementById('fe-library-filter-value')?.value||'';filterValue?win.__feApplyLibraryFilter?.():renderGrid()},0)}})}
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
