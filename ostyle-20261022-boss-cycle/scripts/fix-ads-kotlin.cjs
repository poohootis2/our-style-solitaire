'use strict';

// React Native 0.81 compatibility patch. Does not change Android project configuration.
const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');

function codeLines(source, callback) {
  let inBlockComment = false;
  return source.split(/(?<=\n)/).map((line) => {
    let code = line;
    if (inBlockComment) {
      if (line.includes('*/')) inBlockComment = false;
      return line;
    }
    if (line.trimStart().startsWith('/*')) {
      inBlockComment = !line.includes('*/');
      return line;
    }
    const index = line.indexOf('//');
    if (index >= 0) code = line.slice(0, index);
    return callback(code) + line.slice(code.length);
  }).join('');
}

function patchSource(source) {
  return codeLines(source, (code) => code
    .replace(/\breactApplicationContext\s*\.\s*currentActivity\b/g,
      'reactApplicationContext.getCurrentActivity()')
    .replace(/(?<![\w.])\bcurrentActivity\b/g,
      'reactApplicationContext.getCurrentActivity()')
    .replace(/(?<![\w.])\bgetCurrentActivity\b(?!\s*\()/g,
      'reactApplicationContext.getCurrentActivity()'));
}

function validatePatchedSource(source, filename) {
  codeLines(source, (code) => {
    if (/\bcurrentActivity\b/.test(code) || /(?<![\w.])\bgetCurrentActivity\b(?!\s*\()/.test(code)) {
      throw new Error(`Unpatched Activity reference in ${filename}; no further changes made.`);
    }
    return code;
  });
}

function readUtf8(file) {
  const bytes = fs.readFileSync(file);
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}

function applyPatch(projectRoot, { optional = false } = {}) {
  const adsRoot = path.join(projectRoot, 'node_modules', 'react-native-google-mobile-ads');
  if (!fs.existsSync(adsRoot)) {
    if (optional) {
      console.log('[ADFIX] Ads package not installed yet; skipped.');
      return { changed: 0, skipped: true };
    }
    throw new Error('react-native-google-mobile-ads is not installed in this project.');
  }
  const version = JSON.parse(readUtf8(path.join(adsRoot, 'package.json'))).version;
  const sourceDir = path.join(adsRoot, 'android', 'src', 'main', 'java', 'io', 'invertase', 'googlemobileads');
  const filenames = [
    'ReactNativeGoogleMobileAdsFullScreenAdModule.kt',
    'ReactNativeGoogleMobileAdsModule.kt',
  ];
  // Compute and validate every change before writing anything.
  const changes = filenames.map((filename) => {
    const file = path.join(sourceDir, filename);
    if (!fs.existsSync(file)) throw new Error(`Missing Kotlin source: ${filename}`);
    const before = readUtf8(file);
    const after = patchSource(before);
    validatePatchedSource(after, filename);
    return { filename, file, before, after };
  }).filter(({ before, after }) => before !== after);
  if (!changes.length) {
    console.log(`[ADFIX] Ads ${version}: already compatible. No files changed.`);
    return { changed: 0, version };
  }
  // Backups contain only these library source files, never signing material.
  const backupDir = path.join(projectRoot, '.adfix-backups', `${Date.now()}-${process.pid}`);
  fs.mkdirSync(backupDir, { recursive: true });
  for (const change of changes) {
    fs.copyFileSync(change.file, path.join(backupDir, change.filename));
  }
  const written = [];
  try {
    for (const change of changes) {
      fs.writeFileSync(change.file, change.after, 'utf8');
      written.push(change);
      if (readUtf8(change.file) !== change.after) throw new Error('Source write verification failed.');
    }
  } catch (error) {
    for (const change of written) fs.writeFileSync(change.file, change.before, 'utf8');
    throw error;
  }
  console.log(`[ADFIX] Ads ${version}: patched ${changes.length} Kotlin file(s).`);
  for (const change of changes) console.log(`[ADFIX] ${change.filename}`);
  console.log(`[ADFIX] Kotlin-only backup: ${backupDir}`);
  console.log('[ADFIX] Signing keys, passwords, Gradle config, app version and ad IDs were NOT changed.');
  return { changed: changes.length, version, backupDir };
}

function installHook(projectRoot) {
  const packageFile = path.join(projectRoot, 'package.json');
  const before = readUtf8(packageFile);
  const pkg = JSON.parse(before);
  const command = 'node scripts/fix-ads-kotlin.cjs --optional';
  pkg.scripts = pkg.scripts || {};
  const current = pkg.scripts.postinstall || '';
  const targetFile = path.join(projectRoot, 'scripts', 'fix-ads-kotlin.cjs');
  fs.mkdirSync(path.dirname(targetFile), { recursive: true });
  if (path.resolve(targetFile) !== path.resolve(__filename)) {
    if (fs.existsSync(targetFile) && !fs.readFileSync(targetFile).equals(fs.readFileSync(__filename))) {
      throw new Error('A different fix-ads-kotlin.cjs already exists; not overwriting it.');
    }
    fs.copyFileSync(__filename, targetFile);
  }
  if (!current.includes(command)) {
    pkg.scripts.postinstall = current ? `${current} && ${command}` : command;
    const backupDir = path.join(projectRoot, '.adfix-backups', `${Date.now()}-${process.pid}-hook`);
    fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(packageFile, path.join(backupDir, 'package.json'));
    fs.writeFileSync(packageFile, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log('[ADFIX] Added postinstall hook; existing scripts and dependencies preserved.');
  } else {
    console.log('[ADFIX] Postinstall hook already installed.');
  }
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    const projectIndex = args.indexOf('--project');
    if (projectIndex >= 0 && !args[projectIndex + 1]) throw new Error('--project requires a project path.');
    const root = path.resolve(projectIndex >= 0 ? args[projectIndex + 1] : process.cwd());
    applyPatch(root, { optional: args.includes('--optional') });
    if (args.includes('--install-hook')) installHook(root);
  } catch (error) {
    console.error(`[ADFIX FAILED] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { applyPatch, installHook, patchSource, validatePatchedSource };
