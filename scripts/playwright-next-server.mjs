import { spawn, spawnSync } from "node:child_process";

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "localhost"], {
  stdio: "inherit",
  windowsHide: true
});

let requestedExitCode;
let requestShutdown;
const shutdownRequested = new Promise((resolve) => {
  requestShutdown = (exitCode) => {
    requestedExitCode ??= exitCode;
    resolve();
  };
});

process.once("SIGINT", () => requestShutdown(130));
process.once("SIGTERM", () => requestShutdown(0));
process.once("SIGHUP", () => requestShutdown(0));
process.once("uncaughtException", (error) => {
  console.error(error);
  requestShutdown(1);
});
process.once("unhandledRejection", (error) => {
  console.error(error);
  requestShutdown(1);
});
process.once("exit", terminateChildTreeSync);

let childExitCode = 0;
try {
  const result = await Promise.race([
    new Promise((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
      child.once("error", (error) => resolve({ error }));
    }),
    shutdownRequested.then(() => ({ shutdown: true }))
  ]);

  if ("error" in result) {
    console.error(result.error);
    childExitCode = 1;
  } else if ("shutdown" in result) {
    childExitCode = requestedExitCode ?? 0;
  } else {
    childExitCode = result.code ?? (result.signal ? 0 : 1);
  }
} finally {
  await terminateChildTree();
}

process.exitCode = childExitCode;

async function terminateChildTree() {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true
      });
      const timeout = setTimeout(resolve, 2000);
      killer.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
      killer.once("error", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 1500))
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

function terminateChildTreeSync() {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }

  child.kill("SIGKILL");
}
