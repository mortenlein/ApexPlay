const { existsSync, rmSync } = require('fs');
const { join } = require('path');

const nextBuildDir = join(process.cwd(), '.next');

if (existsSync(nextBuildDir)) {
  rmSync(nextBuildDir, { recursive: true, force: true });
}
