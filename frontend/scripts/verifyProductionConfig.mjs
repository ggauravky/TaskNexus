import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAuthError } from "../src/utils/authError.js";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(frontendRoot, "..");
const read = (file) => fs.readFileSync(file, "utf8");
const production = JSON.parse(read(path.join(frontendRoot, "production.config.json")));
const vercel = JSON.parse(read(path.join(frontendRoot, "vercel.json")));
const render = read(path.join(repositoryRoot, "render.yaml"));
const builtHtml = read(path.join(frontendRoot, "dist", "index.html"));

assert.match(production.siteOrigin, /^https:\/\/[^/]+$/);
assert.match(production.apiOrigin, /^https:\/\/[^/]+\.onrender\.com$/);
assert.equal(production.apiBaseUrl, `${production.apiOrigin}/api`);

const globalHeaders = vercel.headers.find((entry) => entry.source === "/(.*)")?.headers || [];
const csp = globalHeaders.find((header) => header.key === "Content-Security-Policy")?.value || "";
assert.ok(csp.includes(`connect-src 'self' ${production.apiOrigin}`));
assert.ok(!csp.includes("tasknexus-backend.onrender.com"));
assert.ok(!/connect-src[^;]*\*/.test(csp), "connect-src must not contain a wildcard");

assert.ok(render.includes(`value: ${production.siteOrigin}`));
assert.ok(!render.includes("https://tasknexus.vercel.app"));

const inlineJsonLd = [...builtHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
assert.ok(inlineJsonLd.length > 0, "Built HTML must contain inline JSON-LD");
const expectedJsonLdHashes = inlineJsonLd.map((match) =>
  `sha256-${crypto.createHash("sha256").update(match[1]).digest("base64")}`
);
const scriptSrc = csp.match(/(?:^|;\s*)script-src\s+([^;]+)/)?.[1] || "";
const configuredScriptHashes = [...scriptSrc.matchAll(/'((?:sha256)-[^']+)'/g)]
  .map((match) => match[1]);
assert.deepEqual(
  configuredScriptHashes.sort(),
  expectedJsonLdHashes.sort(),
  `CSP JSON-LD hashes differ from built HTML. Expected: ${expectedJsonLdHashes.join(" ")}`,
);

assert.equal(
  normalizeAuthError({ request: {}, code: "ERR_NETWORK" }, "Registration failed").message,
  "Unable to reach the TaskNexus server. Check your connection and try again.",
);
assert.equal(
  normalizeAuthError({ response: { status: 429, data: {} } }, "Login failed").message,
  "Too many attempts. Please wait a moment and try again.",
);
assert.deepEqual(
  normalizeAuthError({ response: { data: { error: { message: "Email already registered", details: [] } } } }),
  { message: "Email already registered", details: [] },
);

process.stdout.write(
  `Production frontend configuration verified: ${production.siteOrigin} -> ${production.apiBaseUrl}\n`,
);
