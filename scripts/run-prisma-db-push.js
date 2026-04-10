const { spawnSync } = require("child_process");
const { resolveSQLiteUrl } = require("./resolve-sqlite-url");

const env = {
  ...process.env,
  DATABASE_URL: resolveSQLiteUrl(process.env.DATABASE_URL || "file:./dev.db"),
};

const prismaArgs = process.argv.slice(2).join(" ");
const prismaCommand = `npx prisma db push${prismaArgs ? ` ${prismaArgs}` : ""}`;
const result =
  process.platform === "win32"
    ? spawnSync("powershell.exe", ["-Command", prismaCommand], {
        stdio: "inherit",
        env,
      })
    : spawnSync(prismaCommand, {
        stdio: "inherit",
        env,
        shell: true,
      });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
