require("../src/config/loadEnv");
const assert = require("node:assert/strict");
const { createGitHubProvider } = require("../src/providers/githubProvider");

const run = async () => {
  const provider = createGitHubProvider();
  const repository = await provider.verifyRepository({ owner: "octocat", repository: "Hello-World" });
  assert.equal(repository.isPrivate, false);
  const commit = await provider.verifyCommit({ owner: "octocat", repository: "Hello-World", ref: "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d" });
  assert.equal(commit.authorLogin.toLowerCase(), "octocat");
  const pullRequest = await provider.verifyPullRequest({ owner: "octocat", repository: "Hello-World", ref: "11096" });
  assert.equal(pullRequest.number, "11096");
  process.stdout.write(`GitHub public-read QA passed for octocat/Hello-World: repository, commit ${commit.sha.slice(0, 7)}, and PR #${pullRequest.number} (${pullRequest.state}${pullRequest.merged ? ", merged" : ", not merged"}).\n`);
};

run().catch((error) => { process.stderr.write(`GitHub public-read QA failed: ${error.code || error.name}: ${error.message}\n`); process.exitCode = 1; });
