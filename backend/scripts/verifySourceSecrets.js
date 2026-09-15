const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const trackedAndUntracked = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root },
).toString("utf8").split("\0").filter(Boolean);

const credentialAssignment = /\b(MONGODB_URI|JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|BREVO_API_KEY|GITHUB_TOKEN|ADMIN_PASSWORD)[ \t]*=[ \t]*([^\s"'#]+)/g;
const knownPlaceholder = (value) =>
  !value || /^(?:<.*>|REPLACE_|CHANGE_|your_|example|dummy|test|fake|\$\{|%)/i.test(value) ||
  value.includes("example.invalid");
const findings = [];

for (const relativePath of trackedAndUntracked) {
  const absolutePath = path.join(root, relativePath);
  const stat = fs.statSync(absolutePath);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;
  const bytes = fs.readFileSync(absolutePath);
  if (bytes.includes(0)) continue;
  const content = bytes.toString("utf8");

  for (const [name, pattern] of [
    ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
    ["Stripe live secret", /\bsk_live_[A-Za-z0-9]{20,}\b/],
    ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
    ["Brevo API key", /\bxkeysib-[A-Za-z0-9_-]{30,}\b/],
  ]) {
    if (pattern.test(content)) findings.push({ relativePath, name });
  }

  for (const match of content.matchAll(credentialAssignment)) {
    if (!knownPlaceholder(match[2])) findings.push({
      relativePath,
      name: `non-placeholder ${match[1]} assignment`,
    });
  }

  const mongoCredentials = content.match(/mongodb(?:\+srv)?:\/\/[^:\s/]+:[^@\s/]+@[^\s"'`]+/g) || [];
  if (mongoCredentials.some((value) => !value.includes("example.invalid"))) {
    findings.push({ relativePath, name: "credential-bearing MongoDB URI" });
  }
}

if (findings.length) {
  for (const finding of findings) {
    process.stderr.write(`Potential ${finding.name} in ${finding.relativePath}\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`Source secret scan passed across ${trackedAndUntracked.length} repository files.\n`);
}
