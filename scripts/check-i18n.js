// Fails if the message catalogues drift apart. A missing key renders as the raw key path in
// production ("player.matchesAhead"), which is worse than an untranslated English word.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'messages');
const flat = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flat(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );

const locales = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
const keys = Object.fromEntries(
  locales.map((l) => [l, flat(JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), 'utf8')))])
);

const base = 'en';
let failed = false;
for (const locale of locales) {
  if (locale === base) continue;
  const missing = keys[base].filter((k) => !keys[locale].includes(k));
  const extra = keys[locale].filter((k) => !keys[base].includes(k));
  if (missing.length) {
    failed = true;
    console.error(`[i18n] ${locale} is missing ${missing.length} key(s):\n  ${missing.join('\n  ')}`);
  }
  if (extra.length) {
    failed = true;
    console.error(`[i18n] ${locale} has ${extra.length} key(s) not in ${base}:\n  ${extra.join('\n  ')}`);
  }
}
if (failed) process.exit(1);
console.log(`[i18n] ${locales.join(', ')} — ${keys[base].length} keys, all in sync.`);
