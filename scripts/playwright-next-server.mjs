import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "localhost"], {
  stdio: "inherit",
  windowsHide: true
});

let isShuttingDown = false;

function shutdown(signal = "SIGTERM") {
  if (isShuttingDown) return;
  isShuttingDown = true;

  if (!child.killed) {
    child.kill(signal);
  }

  setTimeout(() => {
    if (!child.killed) {
      child.kill("SIGKILL");
    }
    process.exit(0);
  }, 1500).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGHUP", () => shutdown("SIGHUP"));

child.on("exit", (code, signal) => {
  if (isShuttingDown) {
    process.exit(0);
  }

  process.exit(code ?? (signal ? 0 : 1));
});
