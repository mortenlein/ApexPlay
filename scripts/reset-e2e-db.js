const { rmSync } = require("fs");
const { join } = require("path");

const databasePaths = [
  join(process.cwd(), "prisma", "e2e.db"),
  join(process.cwd(), "prisma", "e2e.db-journal"),
  // Cleanup for older incorrect file:./prisma/e2e.db URLs, which resolve under prisma/prisma.
  join(process.cwd(), "prisma", "prisma", "e2e.db"),
  join(process.cwd(), "prisma", "prisma", "e2e.db-journal"),
];

for (const filePath of databasePaths) {
  try {
    rmSync(filePath, { force: true });
  } catch (error) {
    console.error(`Failed to remove ${filePath}:`, error);
    process.exit(1);
  }
}
