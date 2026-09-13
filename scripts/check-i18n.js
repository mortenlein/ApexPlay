// Fails if the message catalogues drift apart. A missing key renders as its raw path in
// production ("player.matchesAhead"), which is worse than an untranslated English word.
//
// Layout is one file per namespace per locale: messages/<locale>/<namespace>.json — so that
// people translating different surfaces never edit the same file.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'messages');
const BASE = 'en';

const flat = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

const locales = fs
  .readdirSync(dir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

function keysFor(locale) {
  const localeDir = path.join(dir, locale);
  return fs
    .readdirSync(localeDir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      const ns = f.replace('.json', '');
      let parsed;
      try {
        parsed = JSON.parse(fs.readFileSync(path.join(localeDir, f), 'utf8'));
      } catch (err) {
        console.error(`[i18n] ${locale}/${f} is not valid JSON: ${err.message}`);
        process.exitCode = 1;
        return [];
      }
      return flat(parsed, `${ns}.`);
    });
}

const keys = Object.fromEntries(locales.map((l) => [l, keysFor(l)]));
let failed = process.exitCode === 1;

for (const locale of locales) {
  if (locale === BASE) continue;
  const missing = keys[BASE].filter((k) => !keys[locale].includes(k));
  const extra = keys[locale].filter((k) => !keys[BASE].includes(k));
  if (missing.length) {
    failed = true;
    console.error(`[i18n] ${locale} is missing ${missing.length} key(s):\n  ${missing.join('\n  ')}`);
  }
  if (extra.length) {
    failed = true;
    console.error(`[i18n] ${locale} has ${extra.length} key(s) not in ${BASE}:\n  ${extra.join('\n  ')}`);
  }
}

// An empty string is almost always an unfinished translation rather than an intended blank.
for (const locale of locales) {
  const localeDir = path.join(dir, locale);
  for (const f of fs.readdirSync(localeDir).filter((x) => x.endsWith('.json'))) {
    const parsed = JSON.parse(fs.readFileSync(path.join(localeDir, f), 'utf8'));
    const blanks = Object.entries(parsed).filter(([, v]) => v === '');
    if (blanks.length) {
      failed = true;
      console.error(`[i18n] ${locale}/${f} has empty value(s): ${blanks.map(([k]) => k).join(', ')}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 2: every key a component asks for must exist.
//
// A missing key does not throw — next-intl renders the key path, so the UI quietly shows
// "bracketStage.semiFinals" to a spectator. That shipped once already (the OBS overlay kept
// pointing at a namespace after its keys moved) and only one e2e assertion caught it.
//
// Heuristic, deliberately: map each `const X = useTranslations('ns')` to its namespace, then
// check every literal `X('key')` in that file. Template literals and computed keys are skipped
// rather than guessed at.
// ---------------------------------------------------------------------------
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const baseKeys = new Set(keys[BASE]);
const srcDir = path.join(__dirname, '..', 'src');
const missingUses = [];

for (const file of walk(srcDir)) {
  const src = fs.readFileSync(file, 'utf8');
  const binding = {};
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*['"`]([\w.]+)['"`]/g)) {
    binding[m[1]] = m[2];
  }
  if (!Object.keys(binding).length) continue;

  for (const m of src.matchAll(/\b(\w+)\(\s*['"]([\w.]+)['"]/g)) {
    const ns = binding[m[1]];
    if (!ns) continue;
    const full = `${ns}.${m[2]}`;
    if (!baseKeys.has(full)) {
      const line = src.slice(0, m.index).split('\n').length;
      missingUses.push(`${path.relative(path.join(__dirname, '..'), file)}:${line}  ${m[1]}('${m[2]}') -> ${full}`);
    }
  }
}

if (missingUses.length) {
  failed = true;
  console.error(`[i18n] ${missingUses.length} call(s) reference a key that does not exist:\n  ${missingUses.join('\n  ')}`);
}

if (failed) process.exit(1);
console.log(`[i18n] ${locales.join(', ')} — ${keys[BASE].length} keys, all in sync.`);
