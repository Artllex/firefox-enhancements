const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../zipquickextract.cfg'), 'utf8');
new vm.Script(source);
const fragment = source.slice(source.indexOf('    function saveContextImage('), source.indexOf('    async function saveHoveredImage('));
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(fragment, sandbox);
for (const scenario of ['image', 'canvas', 'closed', 'link', 'disabled', 'hidden']) {
  const calls = [];
  const popup = { state: scenario === 'closed' ? 'closed' : 'open', hidePopup() { calls.push('hide'); win.gContextMenu = null; } };
  const item = { hidden: scenario === 'hidden', disabled: scenario === 'disabled', getAttribute() { return null; } };
  const win = { document: { getElementById(id) { return id === 'context-saveimage' ? item : popup; } }, gContextMenu: {
    onImage: scenario !== 'link' && scenario !== 'canvas', onCanvas: scenario === 'canvas',
    saveImage() { assert(win.gContextMenu); calls.push('save'); }
  } };
  const expected = ['image', 'canvas'].includes(scenario);
  assert.equal(sandbox.saveContextImage(win), expected, scenario);
  assert.deepEqual(calls, expected ? ['save', 'hide'] : [], scenario);
}
console.log('PASS: native save precedes menu cleanup; closed, hidden, disabled and non-image contexts ignored (mocks).');
