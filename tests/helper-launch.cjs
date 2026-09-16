const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../zipquickextract.cfg'), 'utf8');
const start = source.indexOf('    function getWScriptFile()');
const end = source.indexOf('    function getAppMenuNode(');
assert(start > 0 && end > start);
let launched;
const errors = [];
function file(path) {
  return { path, clone() { return file(this.path); }, append(name) { this.path += '/' + name; }, exists() { return true; } };
}
const context = {
  SECRET_HELPER_NAME: 'firefox_secret_window.ps1',
  SECRET_LAUNCHER_NAME: 'firefox_secret_window.vbs',
  secretHelperStarted: false,
  reportError: e => errors.push(String(e)),
  Ci: {},
  Services: { appinfo: { processID: 123 }, dirsvc: { get(key) {
    return file({ WinD: 'C:/Windows', GreD: 'C:/Firefox', XREExeF: 'C:/Firefox/firefox.exe' }[key]);
  } } },
  Cc: { '@mozilla.org/process/util;1': { createInstance() { return {
    init(executable) { assert.equal(executable.path, 'C:/Windows/System32/wscript.exe'); },
    runwAsync(args, length) { assert.equal(length, args.length); launched = args; }
  }; } } }
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
vm.runInContext('ensureSecretHelperStarted()', context);
assert.deepEqual(errors, []);
assert(launched, 'Helper was not launched');
assert.equal(launched[3], 'C:/Firefox/firefox_secret_window.ps1');
assert.equal(launched[4], '123');
assert.equal(launched[6], 'listen');
assert.equal(context.secretHelperStarted, true);
console.log('PASS: helper launch resolves Windows host and passes correct arguments (mocked process).');
