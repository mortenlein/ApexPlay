const { spawn, spawnSync } = require("child_process");
const { resolveSQLiteUrl } = require("./resolve-sqlite-url");

const env = {
  ...process.env,
  DATABASE_URL: resolveSQLiteUrl(process.env.DATABASE_URL || "file:./e2e.db"),
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
runStep(nodeCommand, ["scripts/setup-db.js"]);

const devServer =
  process.platform === "win32"
    ? spawn("powershell.exe", ["-Command", "npx next dev -p 4101"], {
        stdio: "inherit",
        env,
      })
    : spawn("npx next dev -p 4101", {
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
