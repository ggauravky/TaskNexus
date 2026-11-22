import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "vite";

const production = JSON.parse(readFileSync(new URL("../production.config.json", import.meta.url), "utf8"));
const root = fileURLToPath(new URL("../", import.meta.url));
const envDir = fileURLToPath(new URL(".", import.meta.url));

test("production build rejects a staging API override and accepts the canonical API", async (t) => {
  const savedEnvironment = { NODE_ENV: process.env.NODE_ENV, VITE_API_URL: process.env.VITE_API_URL };
  t.after(() => {
    for (const [name, value] of Object.entries(savedEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  process.env.NODE_ENV = "production";
  const resolveBuild = () => resolveConfig({ root, envDir }, "build", "production", "production");

  process.env.VITE_API_URL = "https://staging.example.invalid/api";
  await assert.rejects(resolveBuild(), /VITE_API_URL does not match the canonical production API URL/);

  process.env.VITE_API_URL = `${production.apiBaseUrl}/`;
  assert.equal((await resolveBuild()).isProduction, true);
});
