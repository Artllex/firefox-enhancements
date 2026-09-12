// Local data bridge for Download Router. No network listener or executable input.
const { Downloads } = ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs");
const { DownloadHistory } = ChromeUtils.importESModule("resource://gre/modules/DownloadHistory.sys.mjs");

export async function synchronize(request) {
  const { source, destination, startTime, sourceUrl } = request;
  if (typeof source !== "string" || typeof destination !== "string" ||
      !/^[a-z]:\\/i.test(source) || !/^[a-z]:\\/i.test(destination) ||
      !Number.isFinite(startTime) || typeof sourceUrl !== "string" || !sourceUrl) {
    throw new Error("Invalid download relocation request.");
  }
  const list = await Downloads.getList(Downloads.PUBLIC);
  const matches = (await list.getAll()).filter(d =>
    Number(d.startTime) === startTime && d.source.url === sourceUrl &&
    d.stopped && d.succeeded && !d.source.isPrivate &&
    [source.toLowerCase(), destination.toLowerCase()].includes(d.target.path.toLowerCase()));
  if (matches.length !== 1) throw new Error("No unique completed download in this profile.");
  const download = matches[0];
  if (source.toLowerCase() === destination.toLowerCase() || await IOUtils.exists(source)) {
    throw new Error("Source still exists or paths are equal.");
  }
  const stat = await IOUtils.stat(destination);
  if (stat.type !== "regular" || stat.size !== download.target.size) throw new Error("Destination does not match downloaded file.");
  download.target.path = destination;
  await download.target.refresh();
  download._notifyChange();
  // Completed desktop downloads are persisted in Places.
  await DownloadHistory.addDownloadToHistory(download);
  await DownloadHistory.updateMetaData(download);
  return { source, destination, startTime, applied: true };
}

let timer = null;
let namesStarted = false;
// Capture the sanitized name before Firefox resolves collisions in Downloads.
// Keep private/unmatched captures in memory only; persist public download identity.
export function captureOriginalNames(queue) {
  if (namesStarted) return;
  const { DownloadPaths } = ChromeUtils.importESModule("resource://gre/modules/DownloadPaths.sys.mjs");
  const original = DownloadPaths.createNiceUniqueFile;
  const captures = new Map();
  const records = [];
  let writes = Promise.resolve();
  DownloadPaths.createNiceUniqueFile = function(template) {
    const name = template.leafName;
    const file = original.apply(this, arguments);
    try {
      captures.set(file.path.toLowerCase(), { name, at: Date.now() });
      for (const [key, value] of captures) {
        if (Date.now() - value.at > 60000 || captures.size > 512) captures.delete(key);
      }
    } catch (error) { console.error(error); }
    return file;
  };
  namesStarted = true;
  Downloads.getList(Downloads.PUBLIC).then(list => list.addView({
    onDownloadAdded(download) {
      const key = download.target.path.toLowerCase();
      const captured = captures.get(key);
      if (!captured || download.source.isPrivate || Math.abs(Number(download.startTime) - captured.at) > 60000) return;
      captures.delete(key);
      records.push({ source: download.target.path, startTime: Number(download.startTime), sourceUrl: download.source.url, name: captured.name });
      if (records.length > 512) records.shift();
      const snapshot = records.slice();
      writes = writes.catch(() => {}).then(async () => {
        await IOUtils.makeDirectory(queue, {createAncestors: true});
        await IOUtils.writeJSON(PathUtils.join(queue, "original-names.json"), snapshot, {tmpPath: PathUtils.join(queue, "original-names.tmp")});
      });
      writes.catch(console.error);
    }
  })).catch(console.error);
}

export function start() {
  if (timer) return;
  const local = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment).get("LOCALAPPDATA");
  const queue = PathUtils.join(local, "Programs", "ChatGPTFolderLauncher", "sync-requests");
  try { captureOriginalNames(queue); } catch (error) { console.error(error); }
  let busy = false;
  const attempted = new Map();
  async function poll() {
    if (busy) return;
    busy = true;
    try {
      if (!(await IOUtils.exists(queue))) return;
      const children = await IOUtils.getChildren(queue);
      const present = new Set(children);
      for (const path of attempted.keys()) if (!present.has(path)) attempted.delete(path);
      for (const path of children) {
        if (!/^[a-f0-9]{32}\.json$/.test(PathUtils.filename(path))) continue;
        if (Date.now() - (attempted.get(path) || 0) < 10000) continue;
        attempted.set(path, Date.now());
        try {
          const stat = await IOUtils.stat(path);
          if (stat.size > 16384) continue;
          const request = await IOUtils.readJSON(path);
          // Unmatched requests can belong to another profile. Never consume them.
          if (Date.now() - request.startTime > 86400000) continue;
          const result = await synchronize(request);
          await IOUtils.writeJSON(PathUtils.join(queue, "last-result.json"), result);
          await IOUtils.remove(path);
          attempted.delete(path);
        } catch (error) { console.debug("ZIP Quick Extract location sync:", String(error)); }
      }
    } finally { busy = false; }
  }
  timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
  timer.initWithCallback(() => poll().catch(console.error), 1000, Ci.nsITimer.TYPE_REPEATING_SLACK);
  Services.obs.addObserver({observe() {timer.cancel();}}, "quit-application");
}
