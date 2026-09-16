const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../FirefoxEnhancementsHoverChild.sys.mjs'), 'utf8');
const sandbox = {
  JSWindowActorChild: class {}, Ci: {},
  Cc: { '@mozilla.org/referrer-info;1': { createInstance: () => ({ initWithElement() {} }) } },
  ChromeUtils: { importESModule: () => ({ E10SUtils: { serializeReferrerInfo: () => 'referrer', serializeCookieJarSettings: () => 'cookies' } }) }
};
vm.createContext(sandbox);
vm.runInContext(source.replace('export class', 'class') + '\nglobalThis.Actor = FirefoxEnhancementsHoverChild;', sandbox);
const actor = new sandbox.Actor();
let hovered = [];
actor.document = { hidden: false, querySelectorAll(selector) { assert.equal(selector, ':hover'); return hovered; } };
const query = () => actor.receiveMessage({ name: 'GetHoveredImage' });
assert.equal(query(), null);
const image = { localName: 'img', complete: true, naturalWidth: 120, currentSrc: 'https://example.org/large.png', src: 'https://example.org/small.png' };
hovered = [image];
assert.equal(query().url, image.currentSrc);
hovered = [];
assert.equal(query(), null, 'Must not return previous image after pointer leaves');
hovered = [{ shadowRoot: { querySelectorAll: () => [image] } }];
assert.equal(query().url, image.currentSrc);
image.complete = false;
assert.equal(query(), null);
image.complete = true;
actor.document.hidden = true;
assert.equal(query(), null);
console.log('PASS: current hovered image, responsive URL, shadow DOM, pointer exit, unloaded image and hidden document (mocks).');
