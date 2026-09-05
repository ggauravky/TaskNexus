const { createGitHubProvider, GitHubProviderError } = require("../src/providers/githubProvider");

const response = (body, status = 200, headers = {}) => ({
  ok: status >= 200 && status < 300, status,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  json: jest.fn().mockResolvedValue(body),
});

describe("GitHub provider abstraction", () => {
  test("constructs repository API URLs from parsed identifiers and keeps bounded metadata", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({
      owner: { login: "octocat" }, name: "Hello-World", html_url: "https://github.com/octocat/Hello-World",
      description: "A public repository", default_branch: "master", private: false, archived: false,
    }));
    const provider = createGitHubProvider({ fetchImpl, token: "" });
    await expect(provider.verifyRepository({ owner: "octocat", repository: "Hello-World" })).resolves.toEqual(expect.objectContaining({ isPrivate: false, repository: "Hello-World" }));
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.github.com/repos/octocat/Hello-World");
    expect(fetchImpl.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
  });

  test("normalizes commit authorship without storing patches or email identity", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({
      sha: "6dcb09b5b57875f334f61aebed695e2e4193db5e", html_url: "https://github.com/octocat/Hello-World/commit/6dcb",
      author: { login: "octocat" }, commit: { message: "Fix all the bugs\nprivate body", author: { email: "not-identity@example.com", date: "2011-04-14T16:00:49Z" }, verification: { reason: "unsigned" } },
      files: [{ filename: "secret", patch: "never persist" }],
    }));
    const result = await createGitHubProvider({ fetchImpl, token: "" }).verifyCommit({ owner: "octocat", repository: "Hello-World", ref: "6dcb09b" });
    expect(result).toEqual(expect.objectContaining({ authorLogin: "octocat", title: "Fix all the bugs" }));
    expect(result).not.toHaveProperty("files"); expect(result).not.toHaveProperty("email");
  });

  test("retains pull request state so open work is never described as completed", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({
      number: 7, html_url: "https://github.com/acme/repo/pull/7", user: { login: "mira" },
      title: "Improve navigation", state: "open", merged: false, merged_at: null, closed_at: null, created_at: "2026-01-02T00:00:00Z",
    }));
    const result = await createGitHubProvider({ fetchImpl, token: "" }).verifyPullRequest({ owner: "acme", repository: "repo", ref: "7" });
    expect(result).toEqual(expect.objectContaining({ state: "open", merged: false, authorLogin: "mira" }));
  });

  test("maps not-found and primary rate-limit responses", async () => {
    const missing = createGitHubProvider({ fetchImpl: jest.fn().mockResolvedValue(response({}, 404)), token: "" });
    await expect(missing.verifyRepository({ owner: "x", repository: "y" })).rejects.toEqual(expect.objectContaining({ code: "GITHUB_NOT_FOUND", statusCode: 404 }));
    const limited = createGitHubProvider({ fetchImpl: jest.fn().mockResolvedValue(response({}, 403, { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1893456000" })), token: "" });
    await expect(limited.verifyRepository({ owner: "x", repository: "y" })).rejects.toBeInstanceOf(GitHubProviderError);
    await expect(limited.verifyRepository({ owner: "x", repository: "y" })).rejects.toEqual(expect.objectContaining({ code: "GITHUB_RATE_LIMITED", statusCode: 429 }));
  });
});
