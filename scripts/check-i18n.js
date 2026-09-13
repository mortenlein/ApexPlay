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

if (failed) process.exit(1);
console.log(`[i18n] ${locales.join(', ')} — ${keys[BASE].length} keys, all in sync.`);
