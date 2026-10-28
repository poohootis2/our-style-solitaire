'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { patchSource, applyPatch, installHook } = require('../scripts/fix-ads-kotlin.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adfix-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const ads = path.join(root, 'node_modules', 'react-native-google-mobile-ads');
  const sources = path.join(ads, 'android/src/main/java/io/invertase/googlemobileads');
  fs.mkdirSync(sources, { recursive: true });
  fs.writeFileSync(path.join(ads, 'package.json'), '{"version":"14.7.0"}\n');
  fs.writeFileSync(path.join(sources, 'ReactNativeGoogleMobileAdsFullScreenAdModule.kt'), 'val activity = currentActivity\nval second = getCurrentActivity\n');
  fs.writeFileSync(path.join(sources, 'ReactNativeGoogleMobileAdsModule.kt'), 'val activity = reactApplicationContext.currentActivity\ncurrentActivity?.runOnUiThread { action() }\n');
  return { root, sources };
}

test('converts Kotlin Activity access without damaging UTF-8 or CRLF', () => {
  const input = '// currentActivity 한글 안내\r\nval activity = currentActivity\r\nval context = reactApplicationContext.currentActivity\r\nval other = getCurrentActivity\r\n';
  const output = patchSource(input);
  assert.equal(output, '// currentActivity 한글 안내\r\nval activity = reactApplicationContext.getCurrentActivity()\r\nval context = reactApplicationContext.getCurrentActivity()\r\nval other = reactApplicationContext.getCurrentActivity()\r\n');
  assert.equal(patchSource(output), output);
});

test('leaves proper method calls, block comments and unrelated symbols unchanged', () => {
  const input = '/* currentActivity\n * getCurrentActivity\n */\nval activity = getCurrentActivity()\nval context = reactApplicationContext.getCurrentActivity()\nval currentActivityName = "ok"\n';
  assert.equal(patchSource(input), input);
});

test('patches only two library files, backs them up, and is idempotent', (t) => {
  const { root, sources } = fixture(t);
  const signing = path.join(root, 'android', 'app');
  fs.mkdirSync(signing, { recursive: true });
  const key = path.join(signing, 'upload-keystore-brandnew.jks');
  const props = path.join(root, 'android', 'keystore.properties');
  const gradle = path.join(signing, 'build.gradle');
  fs.writeFileSync(key, Buffer.from([0, 127, 255, 3]));
  fs.writeFileSync(props, 'SECRET_TEST_VALUE\n');
  fs.writeFileSync(gradle, 'versionCode 43\n');
  const saved = [key, props, gradle].map((f) => fs.readFileSync(f));
  const result = applyPatch(root);
  assert.equal(result.changed, 2);
  assert.equal(fs.readdirSync(result.backupDir).length, 2);
  assert.match(fs.readFileSync(path.join(sources, 'ReactNativeGoogleMobileAdsModule.kt'), 'utf8'), /getCurrentActivity\(\)\?\.runOnUiThread/);
  assert.equal(applyPatch(root).changed, 0);
  [key, props, gradle].forEach((f, i) => assert.deepEqual(fs.readFileSync(f), saved[i]));
});

test('invalid UTF-8 fails before either source is modified', (t) => {
  const { root, sources } = fixture(t);
  const full = path.join(sources, 'ReactNativeGoogleMobileAdsFullScreenAdModule.kt');
  const before = fs.readFileSync(full);
  fs.writeFileSync(path.join(sources, 'ReactNativeGoogleMobileAdsModule.kt'), Buffer.from([0xc3, 0x28]));
  assert.throws(() => applyPatch(root));
  assert.deepEqual(fs.readFileSync(full), before);
});

test('install hook preserves dependency versions and existing postinstall', (t) => {
  const { root } = fixture(t);
  const pkg = { version: '1.8.7', scripts: { postinstall: 'node existing.cjs' }, dependencies: { 'react-native': '0.81.5', 'react-native-google-mobile-ads': '14.7.0' } };
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
  installHook(root);
  const after = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.deepEqual(after.dependencies, pkg.dependencies);
  assert.equal(after.version, pkg.version);
  assert.equal(after.scripts.postinstall, 'node existing.cjs && node scripts/fix-ads-kotlin.cjs --optional');
  installHook(root);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts.postinstall, after.scripts.postinstall);
});

test('optional mode skips a not-yet-installed package', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adfix-empty-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(applyPatch(root, { optional: true }).skipped, true);
  assert.throws(() => applyPatch(root));
});
