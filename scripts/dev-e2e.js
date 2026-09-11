const { spawn, spawnSync } = require("child_process");
const { resolveSQLiteUrl } = require("./resolve-sqlite-url");

const port = process.env.E2E_PORT || "4101";
const env = {
  ...process.env,
  E2E_PORT: port,
  DATABASE_URL: resolveSQLiteUrl(process.env.DATABASE_URL || `file:./e2e-${port}.db`),
};

const nodeCommand = process.execPath;

function runStep(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

runStep(nodeCommand, ["scripts/reset-e2e-db.js"]);
runStep(nodeCommand, ["scripts/migrate.js"]);

const devServer =
  process.platform === "win32"
    ? spawn("powershell.exe", ["-Command", `npx next dev -p ${port}`], {
        stdio: "inherit",
        env,
      })
    : spawn(`npx next dev -p ${port}`, {
        stdio: "inherit",
        env,
        shell: true,
      });

devServer.on("exit", (code) => {
  process.exit(code ?? 0);
});

devServer.on("error", (error) => {
  console.error(error);
  process.exit(1);
});
