// Apply Prisma migrations (replaces the old `db push` / setup-db diff flow).
// Runs `prisma migrate deploy`; if the database predates migrations (created with `db push`,
// so its schema is non-empty with no migration history → P3005), it baselines the database
// against the first migration and retries. Used by dev, build, and the e2e harness.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const prismaCli = require.resolve('prisma/build/index.js');

function run(args) {
  return spawnSync(process.execPath, [prismaCli, ...args], { encoding: 'utf8', env: process.env });
}

function deploy() {
  const r = run(['migrate', 'deploy']);
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.status === 0) return true;
  return r;
}

let res = deploy();
if (res !== true) {
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  if (out.includes('P3005') || /schema is not empty/i.test(out)) {
    const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
    const baseline = fs
      .readdirSync(migrationsDir)
      .filter((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory())
      .sort()[0];
    console.log(`Existing database without migration history — baselining as ${baseline}`);
    const resolve = run(['migrate', 'resolve', '--applied', baseline]);
    if (resolve.stdout) process.stdout.write(resolve.stdout);
    if (resolve.status !== 0) {
      if (resolve.stderr) process.stderr.write(resolve.stderr);
      process.exit(resolve.status || 1);
    }
    res = deploy();
    if (res !== true) {
      if (res.stderr) process.stderr.write(res.stderr);
      process.exit(res.status || 1);
    }
  } else {
    if (res.stderr) process.stderr.write(res.stderr);
    process.exit(res.status || 1);
  }
}
