const { errors } = require("../utils/appError");

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPOSITORY = /^[A-Za-z0-9._-]{1,100}$/;
const SHA = /^[a-f0-9]{7,40}$/i;
const API_ROOT = "https://api.github.com";

const parseUrl = (value, label) => {
  if (typeof value !== "string" || !value.trim()) throw errors.validation(`${label} is required`);
  let url;
  try { url = new URL(value.trim()); } catch { throw errors.validation(`${label} must be a valid GitHub URL`); }
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "github.com" || url.username || url.password || url.port || url.search || url.hash) {
    throw errors.validation(`${label} must use https://github.com`);
  }
  return url;
};

const parseGitHubRepositoryUrl = (value) => {
  const url = parseUrl(value, "Repository URL");
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts.length !== 2) throw errors.validation("Repository URL must identify one GitHub owner and repository");
  const owner = parts[0];
  const repository = parts[1].replace(/\.git$/i, "");
  if (!OWNER.test(owner) || !REPOSITORY.test(repository) || repository === "." || repository === "..") {
    throw errors.validation("Repository URL contains an invalid GitHub owner or repository name");
  }
  return {
    owner, repository, ownerKey: owner.toLowerCase(), repositoryKey: repository.toLowerCase(),
    canonicalUrl: `https://github.com/${owner}/${repository}`,
  };
};

const parseGitHubProfileUrl = (value) => {
  const url = parseUrl(value, "GitHub profile URL");
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts.length !== 1 || !OWNER.test(parts[0])) throw errors.validation("GitHub profile URL must identify one GitHub username");
  return parts[0];
};

const parseGitHubEvidenceUrl = (value) => {
  const url = parseUrl(value, "Evidence URL");
  const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (parts.length !== 4 || !OWNER.test(parts[0]) || !REPOSITORY.test(parts[1])) {
    throw errors.validation("Evidence URL must identify a GitHub commit or pull request");
  }
  const repository = parts[1].replace(/\.git$/i, "");
  if (parts[2] === "commit" && SHA.test(parts[3])) {
    return { kind: "github_commit", owner: parts[0], repository, ref: parts[3].toLowerCase() };
  }
  if (parts[2] === "pull" && /^\d{1,10}$/.test(parts[3]) && Number(parts[3]) > 0) {
    return { kind: "github_pull_request", owner: parts[0], repository, ref: String(Number(parts[3])) };
  }
  throw errors.validation("Evidence URL must be a GitHub commit or pull request URL");
};

const clean = (value, limit) => typeof value === "string" ? value.trim().slice(0, limit) : null;

class GitHubProviderError extends Error {
  constructor(code, message, statusCode = 502, details = null) {
    super(message); this.name = "GitHubProviderError"; this.code = code; this.statusCode = statusCode; this.details = details;
  }
}

const createGitHubProvider = ({ fetchImpl = global.fetch, token = process.env.GITHUB_TOKEN } = {}) => {
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  const request = async (segments) => {
    const path = segments.map((part) => encodeURIComponent(String(part))).join("/");
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "TaskNexus-Evidence/1.0",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetchImpl(`${API_ROOT}/${path}`, { headers, signal: AbortSignal.timeout(8000), redirect: "error" });
    } catch (error) {
      throw new GitHubProviderError("GITHUB_UNAVAILABLE", "GitHub verification is temporarily unavailable", 503, { cause: error.name });
    }
    const remaining = response.headers?.get?.("x-ratelimit-remaining");
    const reset = response.headers?.get?.("x-ratelimit-reset");
    if (response.status === 403 && remaining === "0") {
      throw new GitHubProviderError("GITHUB_RATE_LIMITED", "GitHub verification rate limit reached", 429, { resetAt: reset ? new Date(Number(reset) * 1000).toISOString() : null });
    }
    if (response.status === 404) throw new GitHubProviderError("GITHUB_NOT_FOUND", "GitHub resource was not found", 404);
    if (!response.ok) throw new GitHubProviderError("GITHUB_UNAVAILABLE", "GitHub verification could not be completed", 502, { status: response.status });
    return response.json();
  };

  const verifyRepository = async ({ owner, repository }) => {
    const data = await request(["repos", owner, repository]);
    return {
      owner: clean(data.owner?.login, 100) || owner,
      repository: clean(data.name, 100) || repository,
      canonicalUrl: clean(data.html_url, 500) || `https://github.com/${owner}/${repository}`,
      description: clean(data.description, 280), defaultBranch: clean(data.default_branch, 160),
      isPrivate: Boolean(data.private), archived: Boolean(data.archived),
    };
  };

  const verifyCommit = async ({ owner, repository, ref }) => {
    const data = await request(["repos", owner, repository, "commits", ref]);
    return {
      sha: clean(data.sha, 40), url: clean(data.html_url, 500), authorLogin: clean(data.author?.login, 100),
      title: clean(data.commit?.message?.split("\n")[0], 180) || `Commit ${ref.slice(0, 7)}`,
      occurredAt: data.commit?.author?.date || data.commit?.committer?.date || null,
      verification: clean(data.commit?.verification?.reason, 80),
    };
  };

  const verifyPullRequest = async ({ owner, repository, ref }) => {
    const data = await request(["repos", owner, repository, "pulls", ref]);
    return {
      number: String(data.number), url: clean(data.html_url, 500), authorLogin: clean(data.user?.login, 100),
      title: clean(data.title, 180) || `Pull request #${ref}`, state: clean(data.state, 20),
      merged: Boolean(data.merged || data.merged_at), occurredAt: data.merged_at || data.closed_at || data.created_at || null,
    };
  };

  return { verifyCommit, verifyPullRequest, verifyRepository };
};

module.exports = {
  GitHubProviderError, createGitHubProvider, parseGitHubEvidenceUrl, parseGitHubProfileUrl, parseGitHubRepositoryUrl,
};
