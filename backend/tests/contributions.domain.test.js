const domain = require("../../shared/contracts/domain.json");
const {
  ContributionEvidence, ProjectParticipant, ProjectRepository, ProjectShowcase,
} = require("../src/models");
const authz = require("../src/services/projectAuthorization");
const { buildSummary, publicEvidenceDto } = require("../src/services/contributionService");
const { parseGitHubEvidenceUrl, parseGitHubProfileUrl, parseGitHubRepositoryUrl } = require("../src/providers/githubProvider");

const IDS = {
  team: "50000000-0000-4000-8000-000000000001", project: "50000000-0000-4000-8000-000000000002",
  user: "50000000-0000-4000-8000-000000000003", evidence: "50000000-0000-4000-8000-000000000004",
};
const hasIndex = (Model, keys, options = {}) => Model.schema.indexes().some(([actualKeys, actualOptions]) =>
  JSON.stringify(actualKeys) === JSON.stringify(keys) && Object.entries(options).every(([key, value]) => actualOptions[key] === value));

describe("Phase 5 canonical contribution contracts", () => {
  test("defines explicit evidence truth, lifecycle, repository, and showcase enums", () => {
    expect(domain.contributionVerificationLevels).toEqual(["internal_verified", "external_verified", "unverified"]);
    expect(domain.contributionEvidenceStatuses).toEqual(["active", "revoked", "superseded"]);
    expect(domain.contributionEvidenceTypes).toEqual(expect.arrayContaining(["project_task_completion", "github_commit", "github_pull_request", "external_link"]));
    expect(domain.showcaseStatuses).toEqual(["draft", "published", "unpublished"]);
  });

  test("models reject invalid evidence claims and bound showcase selections", async () => {
    await expect(new ContributionEvidence({
      team_id: IDS.team, project_id: IDS.project, user_id: IDS.user, created_by: IDS.user,
      evidence_type: "productivity_score", verification_level: "trusted", origin: "system",
      title: "Opaque score", source_key: "bad", occurred_at: new Date(),
    }).validate()).rejects.toThrow();
    await expect(new ProjectShowcase({
      team_id: IDS.team, project_id: IDS.project, created_by: IDS.user, updated_by: IDS.user,
      featured_evidence_ids: Array(13).fill(IDS.evidence),
    }).validate()).rejects.toThrow();
  });

  test("declares dedupe and timeline indexes", () => {
    expect(hasIndex(ContributionEvidence, { project_id: 1, source_key: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(ContributionEvidence, { user_id: 1, status: 1, occurred_at: -1 })).toBe(true);
    expect(hasIndex(ProjectRepository, { project_id: 1, provider: 1, owner_key: 1, repository_key: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(ProjectShowcase, { project_id: 1 }, { unique: true })).toBe(true);
  });

  test("participant profile publication is opt-in and defaults off", async () => {
    const participant = new ProjectParticipant({ team_id: IDS.team, project_id: IDS.project, user_id: IDS.user, role: "contributor" });
    await expect(participant.validate()).resolves.toBeUndefined();
    expect(participant.show_on_profile).toBe(false);
  });

  test("summary is a deterministic count, never a score or rank", () => {
    const summary = buildSummary([
      { evidence_type: "project_task_completion", verification_level: "internal_verified" },
      { evidence_type: "github_commit", verification_level: "external_verified" },
      { evidence_type: "external_link", verification_level: "unverified" },
    ]);
    expect(summary).toEqual({
      total: 3,
      by_type: { project_task_completion: 1, github_commit: 1, external_link: 1 },
      by_verification: { internal_verified: 1, external_verified: 1, unverified: 1 },
    });
    expect(summary).not.toHaveProperty("score");
    expect(summary).not.toHaveProperty("rank");
  });

  test("public evidence DTO strips internal descriptions and metadata", () => {
    const result = publicEvidenceDto({
      id: IDS.evidence, evidence_type: "project_task_completion", verification_level: "internal_verified",
      title: "Secret task title", summary: "private task description", metadata: { admin_note: "never public" },
      source_url: null, occurred_at: new Date("2026-01-01T00:00:00Z"),
    });
    expect(result.title).toBe("Completed project work");
    expect(JSON.stringify(result)).not.toContain("Secret");
    expect(result).not.toHaveProperty("summary");
    expect(result).not.toHaveProperty("metadata");
  });

  test("project managers can manage repositories and showcases while inactive membership remains fenced", () => {
    const base = { project: { visibility: "team", status: "active" }, team: { visibility: "public" }, membership: null, participant: null };
    expect(authz.permissions({ ...base, membership: { role: "owner" } })).toEqual(expect.objectContaining({ manage_repositories: true, manage_showcase: true }));
    expect(authz.permissions({ ...base, membership: { role: "member" }, participant: { role: "lead" } })).toEqual(expect.objectContaining({ manage_repositories: true, manage_showcase: true }));
    expect(authz.permissions({ ...base, participant: { role: "lead" } })).toEqual(expect.objectContaining({ manage_repositories: false, manage_showcase: false }));
  });
});

describe("GitHub URL security boundary", () => {
  test("normalizes canonical repository URLs", () => {
    expect(parseGitHubRepositoryUrl("https://github.com/OpenAI/tasknexus.git/")).toEqual({
      owner: "OpenAI", repository: "tasknexus", ownerKey: "openai", repositoryKey: "tasknexus",
      canonicalUrl: "https://github.com/OpenAI/tasknexus",
    });
  });

  test("rejects non-GitHub, credentialed, query, fragment, and nested repository URLs", () => {
    for (const value of [
      "https://evil.example/openai/tasknexus", "https://github.com@evil.example/openai/tasknexus",
      "https://user:pass@github.com/openai/tasknexus", "https://github.com/openai/tasknexus?x=1",
      "https://github.com/openai/tasknexus/issues", "http://github.com/openai/tasknexus",
    ]) expect(() => parseGitHubRepositoryUrl(value)).toThrow();
  });

  test("parses only commit and pull request evidence on GitHub", () => {
    expect(parseGitHubEvidenceUrl("https://github.com/octocat/Hello-World/commit/6dcb09b5b57875f334f61aebed695e2e4193db5e")).toEqual(expect.objectContaining({ kind: "github_commit", ref: "6dcb09b5b57875f334f61aebed695e2e4193db5e" }));
    expect(parseGitHubEvidenceUrl("https://github.com/octocat/Hello-World/pull/1347")).toEqual(expect.objectContaining({ kind: "github_pull_request", ref: "1347" }));
    expect(() => parseGitHubEvidenceUrl("https://github.com/octocat/Hello-World/issues/1")).toThrow();
    expect(parseGitHubProfileUrl("https://github.com/octocat/")).toBe("octocat");
  });
});
