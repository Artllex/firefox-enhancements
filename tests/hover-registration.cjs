const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../zipquickextract.cfg'), 'utf8');
new vm.Script(source);
const block = source.slice(source.indexOf('    // Failure of this optional feature'), source.indexOf('    function ensureShortcutDiagnostic'));
let errors = 0;
vm.runInNewContext(block, {ChromeUtils: {registerWindowActor(name, options) {
  assert.equal(options.safeForUntrustedWebProcess, true);
  assert.equal(options.child.esModuleURI, 'resource://artllex-shared/FirefoxEnhancementsHoverChild.sys.mjs');
  throw Error('simulated registration failure');
}}, reportError() { errors++; }});
assert.equal(errors, 1);
console.log('PASS: complete config parses; actor registration failure is isolated.');
