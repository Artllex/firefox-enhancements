const { PrivateBrowsingUtils } = ChromeUtils.importESModule('resource://gre/modules/PrivateBrowsingUtils.sys.mjs');
const { PlacesUtils } = ChromeUtils.importESModule('resource://gre/modules/PlacesUtils.sys.mjs');
const { AsyncShutdown } = ChromeUtils.importESModule('resource://gre/modules/AsyncShutdown.sys.mjs');
const path = PathUtils.join(PathUtils.profileDir, 'firefox-enhancements-library.json');
let entries = Object.create(null);
let writes = Promise.resolve();
let started = false;
let ready;
const windows = new Set();
const sessions = new Map();
const columns = [
  ['domain', 'Domena', 150], ['path', 'Ścieżka', 220],
  ['parameters', 'Parametry', 190],
  ['closed', 'Ostatnie zamknięcie karty', 175],
  ['lastDuration', 'Czas ostatniego otwarcia', 155],
  ['totalDuration', 'Łączny czas otwarcia', 150],
  ['star', 'Oznaczenie', 90], ['open', 'Otwórz', 65]
];

export function splitAddress(uri) {
  try {
    const url = new URL(uri);
    if (!['http:', 'https:', 'ftp:', 'file:'].includes(url.protocol)) return null;
    return { domain: url.hostname.replace(/^www\./i, ''), path: url.pathname.replace(/^\//, ''), parameters: url.search + url.hash };
  } catch (_) { return null; }
}
function refresh() {
  for (const win of windows) win.document.getElementById('placeContent')?.invalidate();
}
function save() {
  const snapshot = JSON.stringify({version: 1, entries});
  writes = writes.catch(console.error).then(() => IOUtils.writeUTF8(path, snapshot, {tmpPath: path + '.tmp'}));
  writes.catch(console.error);
  refresh();
}
function finishSession(browser, closed = false, now = Date.now()) {
  const session = sessions.get(browser);
  if (!session) return;
  sessions.delete(browser);
  const duration = Math.max(0, now - session.started);
  entries[session.url] = {...entries[session.url], lastDuration: duration,
    totalDuration: (entries[session.url]?.totalDuration || 0) + duration,
    ...(closed ? {closed: now} : {})};
  save();
}
function beginSession(browser, url, now = Date.now()) {
  finishSession(browser, false, now);
  if (splitAddress(url)) sessions.set(browser, {url, started: now});
}
function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return '';
  const seconds = Math.round(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`;
}
function installBrowser(win) {
  if (win.__feLibraryTracking || PrivateBrowsingUtils.isWindowPrivate(win) ||
      PathUtils.filename(PathUtils.profileDir) === 'FirefoxSecretProfile') return;
  win.__feLibraryTracking = true;
  ready.then(() => {
    for (const browser of win.gBrowser.browsers) beginSession(browser, browser.currentURI?.spec);
  }).catch(console.error);
  const progress = {onLocationChange(browser, webProgress, request, location) {
    if (webProgress?.isTopLevel) ready.then(() => beginSession(browser, location?.spec)).catch(console.error);
  }};
  win.gBrowser.addTabsProgressListener(progress);
  win.gBrowser.tabContainer.addEventListener('TabClose', event => {
    ready.then(() => finishSession(event.target.linkedBrowser, true)).catch(console.error);
  });
  win.addEventListener('unload', () => {
    try { win.gBrowser.removeTabsProgressListener(progress); } catch (_) {}
    for (const browser of win.gBrowser.browsers) finishSession(browser, true);
  }, {once:true});
}
function installLibrary(win) {
  const tree = win.document.getElementById('placeContent');
  const headers = win.document.getElementById('placeContentColumns');
  if (!tree || !headers || win.__feLibraryColumns) return;
  win.__feLibraryColumns = true;
  const proto = win.PlacesTreeView.prototype;
  const originalText = proto.getCellText;
  const originalType = proto._getColumnType;
  const originalCycle = proto.cycleHeader;
  const originalImage = proto.getImageSrc;
  const originalProperties = proto.getCellProperties;
  const key = column => column?.element?.getAttribute('fe-library-column');
  proto._getColumnType = function(column) { return key(column) ? 100 + columns.findIndex(c => c[0] === key(column)) : originalType.call(this, column); };
  proto.getCellText = function(row, column) {
    const field = key(column);
    if (!field) return originalText.call(this, row, column);
    const url = this._getNodeForRow(row)?.uri;
    const address = splitAddress(url);
    if (!address) return '';
    if (field === 'star') return entries[url]?.star ? '★' : '';
    if (field === 'open') return '↱';
    if (field === 'closed') return entries[url]?.closed ? new Date(entries[url].closed).toLocaleString('pl-PL') : '';
    if (field === 'lastDuration' || field === 'totalDuration') return formatDuration(entries[url]?.[field]);
    return address[field] || '';
  };
  proto.getImageSrc = function(row, column) {
    if (key(column) === 'domain') {
      const titleColumn = this._findColumnByType(this.COLUMN_TYPE_TITLE);
      return titleColumn ? originalImage.call(this, row, titleColumn) : '';
    }
    return originalImage.call(this, row, column);
  };
  proto.getCellProperties = function(row, column) {
    const field = key(column);
    if (field === 'domain') {
      const titleColumn = this._findColumnByType(this.COLUMN_TYPE_TITLE);
      return `${titleColumn ? originalProperties.call(this, row, titleColumn) : ''} fe-domain`;
    }
    if (field === 'star') return entries[this._getNodeForRow(row)?.uri]?.star ? 'fe-star fe-starred' : 'fe-star';
    if (field === 'open') return 'fe-open';
    return originalProperties.call(this, row, column);
  };
  function sortValue(node, field) {
    const address = splitAddress(node?.uri);
    if (!address) return field === 'star' || field.endsWith('Duration') || field === 'closed' ? -1 : '';
    if (field === 'star') return entries[node.uri]?.star ? 1 : 0;
    if (field === 'closed' || field.endsWith('Duration')) return entries[node.uri]?.[field] || -1;
    return address[field] || '';
  }
  proto.cycleHeader = function(column) {
    const field = key(column);
    if (!field || field === 'open') {
      for (const item of headers.querySelectorAll('[fe-library-column]')) item.removeAttribute('sortDirection');
      return originalCycle.call(this, column);
    }
    const element = column.element;
    const direction = element.getAttribute('sortDirection') === 'ascending' ? 'descending' : 'ascending';
    const rows = Array.from({length: this.rowCount}, (_, index) => this._getNodeForRow(index));
    const factor = direction === 'ascending' ? 1 : -1;
    rows.sort((a, b) => {
      const left = sortValue(a, field), right = sortValue(b, field);
      return (typeof left === 'string' ? left.localeCompare(right, 'pl', {sensitivity:'base', numeric:true}) : left - right) * factor;
    });
    this._rows = rows;
    for (const item of headers.querySelectorAll('[sortDirection]')) item.removeAttribute('sortDirection');
    element.setAttribute('sortDirection', direction);
    this._tree.invalidate();
  };
  const style = win.document.createElementNS('http://www.w3.org/1999/xhtml', 'style');
  style.textContent = `
    #placeContent treechildren::-moz-tree-image(fe-domain) { width: 16px; height: 16px; max-width: 16px; max-height: 16px; margin-inline-end: 5px; }
    #placeContent treechildren::-moz-tree-cell-text(fe-starred) { font-size: 16px; color: #f5b400; }
    #placeContent treechildren::-moz-tree-cell-text(fe-open) { font-size: 16px; font-weight: bold; }
  `;
  win.document.documentElement.appendChild(style);
  for (const [field, label, width] of columns) {
    const splitter = win.document.createXULElement('splitter');
    splitter.setAttribute('class', 'tree-splitter');
    const column = win.document.createXULElement('treecol');
    column.id = 'fe-library-' + field;
    column.setAttribute('fe-library-column', field);
    column.setAttribute('label', label);
    column.setAttribute('width', width);
    column.setAttribute('persist', 'width hidden ordinal');
    column.setAttribute('tooltiptext', field === 'star' ? 'Kliknij, aby oznaczyć adres gwiazdką (nie tworzy zakładki).' : label);
    headers.append(splitter, column);
  }
  tree.addEventListener('click', async event => {
    if (event.button !== 0) return;
    const cell = tree.getCellAt(event.clientX, event.clientY);
    const field = key(cell.col);
    if (cell.row < 0 || !['star', 'open'].includes(field)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const url = tree.view._getNodeForRow(cell.row)?.uri;
    if (!splitAddress(url)) return;
    if (field === 'open') {
      const browser = Services.wm.getMostRecentWindow('navigator:browser');
      browser?.openTrustedLinkIn(url, 'tab', {relatedToCurrent:false});
      return;
    }
    await ready;
    entries[url] = {...entries[url], star: !entries[url]?.star};
    save();
  }, true);
  tree.addEventListener('dblclick', event => {
    const cell = tree.getCellAt(event.clientX, event.clientY);
    if (['star', 'open'].includes(key(cell.col))) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  windows.add(win);
  win.addEventListener('unload', () => windows.delete(win), {once:true});
  ready.then(refresh).catch(console.error);
}
export function start() {
  if (started) return;
  started = true;
  ready = (async () => {
    if (await IOUtils.exists(path)) {
      const stored = await IOUtils.readJSON(path);
      if (stored.version !== 1 || !stored.entries || typeof stored.entries !== 'object') throw Error('Invalid library metadata; preserving file.');
      entries = Object.assign(Object.create(null), stored.entries);
    }
  })();
  ready.catch(console.error);
  AsyncShutdown.profileBeforeChange.addBlocker('Firefox Enhancements history timing', async () => {
    for (const browser of Array.from(sessions.keys())) finishSession(browser, true);
    await writes;
  });
  function attach(win) {
    try {
      if (win.document.documentElement.getAttribute('windowtype') === 'Places:Organizer') installLibrary(win);
      if (win.gBrowser) installBrowser(win);
    } catch (error) { console.error(error); }
  }
  Services.obs.addObserver({observe: win => win.addEventListener('load', () => attach(win), {once:true})}, 'domwindowopened');
  Services.obs.addObserver({observe: attach}, 'browser-delayed-startup-finished');
  for (const win of Services.wm.getEnumerator(null)) attach(win);
}
