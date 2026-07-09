import { spawn } from "node:child_process";

const appUrl = "http://127.0.0.1:3000";

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1"], {
  stdio: "inherit",
  windowsHide: true
});

let stopped = false;

function stopServer() {
  if (stopped) return Promise.resolve();
  stopped = true;

  return new Promise((resolve) => {
    if (server.exitCode !== null || server.signalCode !== null) {
      resolve();
      return;
    }

    if (process.platform === "win32" && server.pid) {
      const killer = spawn("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true
      });

      killer.once("exit", () => resolve());
      killer.once("error", () => resolve());
      return;
    }

    const forceTimer = setTimeout(() => {
      if (!server.killed) {
        server.kill("SIGKILL");
      }
      resolve();
    }, 1500);

    server.once("exit", () => {
      clearTimeout(forceTimer);
      resolve();
    });

    if (!server.killed) {
      server.kill("SIGTERM");
    }
  });
}

async function waitForServer() {
  const startedAt = Date.now();
  const timeoutMs = 120_000;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(appUrl);
      if (response.status < 500) return;
    } catch {
      // Next dev is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${appUrl}`);
}

function runPlaywright() {
  return new Promise((resolve) => {
    // Serialize on a single worker. This suite drives one shared `next dev` server, and
    // parallel workers competing for on-demand route compilation exceed the per-test
    // navigation timeout, making `npm run test:e2e` flaky. One worker keeps it deterministic
    // (CI already ran a single worker). Run `npx playwright test` directly for parallel debugging.
    const playwrightArgs = process.argv.slice(2);
    const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--workers=1", ...playwrightArgs], {
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        E2E_SKIP_WEBSERVER: "true"
      }
    });

    child.on("exit", (code) => resolve(code ?? 1));
  });
}

process.on("SIGINT", () => {
  void stopServer().then(() => process.exit(130));
});

process.on("SIGTERM", () => {
  void stopServer().then(() => process.exit(143));
});

try {
  await waitForServer();
  const code = await runPlaywright();
  await stopServer();
  process.exit(code);
} catch (error) {
  await stopServer();
  console.error(error);
  process.exit(1);
}
