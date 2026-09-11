const { rmSync } = require("fs");
const { join } = require("path");

const port = process.env.E2E_PORT || "4101";
const databasePaths = [
  join(process.cwd(), "prisma", `e2e-${port}.db`),
  join(process.cwd(), "prisma", `e2e-${port}.db-journal`),
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
