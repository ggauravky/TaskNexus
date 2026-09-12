const path = require("node:path");
const { spawn } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const backendRoot = path.join(repositoryRoot, "backend");
const frontendRoot = path.join(repositoryRoot, "frontend");
const backendHealthUrl = "http://localhost:5000/health";
const frontendUrl = "http://localhost:5174";
const children = [];
let shuttingDown = false;

const canReach = async (url, requireOk = false) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return requireOk ? response.status === 200 : response.status < 500;
  } catch {
    return false;
  }
};

const waitUntilReachable = async (name, url, requireOk = false) => {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (await canReach(url, requireOk)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`${name} did not become ready within 45 seconds`);
};

const stop = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(exitCode), 500).unref();
};

const startService = (name, args, cwd) => {
  const child = spawn(process.execPath, args, {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`${name} could not start: ${error.message}`);
    stop(1);
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`${name} exited before the QA stack stopped (${signal || code || 0})`);
    stop(code || 1);
  });
};

const main = async () => {
  const backendAlreadyRunning = await canReach(backendHealthUrl, true);
  const frontendAlreadyRunning = await canReach(frontendUrl);

  if (!backendAlreadyRunning) {
    startService("TaskNexus backend", [path.join(backendRoot, "server.js")], backendRoot);
  }
  if (!frontendAlreadyRunning) {
    startService(
      "TaskNexus frontend",
      [path.join(frontendRoot, "node_modules", "vite", "bin", "vite.js"), "--port", "5174"],
      frontendRoot,
    );
  }

  await Promise.all([
    waitUntilReachable("TaskNexus backend", backendHealthUrl, true),
    waitUntilReachable("TaskNexus frontend", frontendUrl),
  ]);

  console.log("\nTaskNexus local QA stack is ready");
  console.log("Backend: http://localhost:5000");
  console.log("MongoDB: connected");
  console.log("Frontend: http://localhost:5174");

  if (!children.length) {
    console.log("Both services were already running.");
  }
};

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

main().catch((error) => {
  console.error(`Local QA startup failed: ${error.message}`);
  stop(1);
});
