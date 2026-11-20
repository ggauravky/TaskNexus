const mockModels = {
  UserProfile: { exists: jest.fn() },
  UserSkill: { find: jest.fn() },
  Skill: { find: jest.fn() },
  ProjectParticipant: { find: jest.fn() },
  Project: { find: jest.fn() },
  Team: { find: jest.fn() },
  ProjectShowcase: { find: jest.fn() },
  ContributionEvidence: { aggregate: jest.fn(), find: jest.fn() },
};

jest.mock("../src/models", () => mockModels);

const service = require("../src/services/professionalProofService");

const query = (rows) => {
  const chain = {
    select: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    session: jest.fn(() => chain),
    hint: jest.fn(() => chain),
    lean: jest.fn().mockResolvedValue(rows),
  };
  return chain;
};

const evidenceGroup = (projectId, rows) => ({
  _id: projectId,
  total: rows.length,
  internal_verified: rows.filter((row) => row.verification_level === "internal_verified").length,
  external_verified: rows.filter((row) => row.verification_level === "external_verified").length,
  unverified: rows.filter((row) => row.verification_level === "unverified").length,
  evidence: rows,
});

const baseEvidence = (overrides = {}) => ({
  id: "evidence-1",
  project_id: "project-1",
  evidence_type: "github_pull_request",
  verification_level: "external_verified",
  title: "Accessible tabs",
  source_url: "https://github.com/example/repo/pull/1",
  occurred_at: new Date("2026-09-30T00:00:00.000Z"),
  ...overrides,
});

const arrange = ({
  profile = true,
  userSkills = [{ id: "user-skill-1", skill_id: "skill-react", is_primary: true }],
  participants = [{ id: "participant-1", project_id: "project-1", team_id: "team-1", role: "contributor", updated_at: new Date("2026-10-01T00:00:00.000Z") }],
  projects = [{ id: "project-1", team_id: "team-1", name: "Accessible work hub", slug: "accessible-work-hub", skill_ids: ["skill-react"], completed_at: new Date("2026-10-01T00:00:00.000Z") }],
  teams = [{ id: "team-1", name: "Studio", slug: "studio" }],
  showcases = [{ id: "showcase-1", project_id: "project-1", status: "published", headline: "Proof", summary: "Summary", hero_image_url: null }],
  skills = [{ id: "skill-react", slug: "react", name: "React", is_active: true }],
  evidenceGroups = [evidenceGroup("project-1", [baseEvidence()])],
} = {}) => {
  mockModels.UserProfile.exists.mockResolvedValue(profile ? { _id: "profile-1" } : null);
  mockModels.UserSkill.find.mockReturnValue(query(userSkills));
  mockModels.ProjectParticipant.find.mockReturnValue(query(participants));
  mockModels.Project.find.mockImplementation((filter) => query(filter.skill_ids
    ? projects.filter((project) => project.skill_ids.some((id) => filter.skill_ids.$in.includes(id)))
    : projects));
  mockModels.Team.find.mockReturnValue(query(teams));
  mockModels.ProjectShowcase.find.mockReturnValue(query(showcases));
  mockModels.Skill.find.mockReturnValue(query(skills));
  mockModels.ContributionEvidence.aggregate.mockResolvedValue(evidenceGroups);
};

describe("professional proof visibility service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    arrange();
  });

  test("rejects a selected project when the candidate selected no evidence", async () => {
    mockModels.ContributionEvidence.find.mockReturnValue(query([baseEvidence()]));
    await expect(service.loadSelectedApplicationProof("user-1", ["project-1"], []))
      .rejects.toThrow(/select.*evidence/i);
  });

  test("requires an explicitly selected item for each selected project", async () => {
    arrange({
      participants: [{ project_id: "project-1" }, { project_id: "project-2" }],
      projects: [{ id: "project-1", team_id: "team-1" }, { id: "project-2", team_id: "team-1" }],
    });
    mockModels.ContributionEvidence.find.mockImplementation((filter) => query(filter._id
      ? [baseEvidence()] : [baseEvidence(), baseEvidence({ id: "evidence-2", project_id: "project-2" })]));
    await expect(service.loadSelectedApplicationProof("user-1", ["project-1", "project-2"], ["evidence-1"]))
      .rejects.toThrow(/select.*evidence/i);
  });

  test("publishes only canonical skill overlap with strict profile proof ancestry", async () => {
    const result = await service.listPublicProfileConnections("user-1");

    expect(result).toEqual([{
      skill: { id: "skill-react", slug: "react", name: "React" },
      projects: [expect.objectContaining({
        id: "project-1",
        target_path: "/showcase/studio/accessible-work-hub",
        evidence_summary: { total: 1, internal_verified: 0, external_verified: 1, unverified: 0 },
      })],
    }]);
    expect(mockModels.ProjectParticipant.find).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-1", status: "active", show_on_profile: true,
    }));
    expect(mockModels.Project.find).toHaveBeenCalledWith(expect.objectContaining({ status: "completed", visibility: "public" }));
    expect(mockModels.Team.find).toHaveBeenCalledWith(expect.objectContaining({ status: "active", visibility: "public" }));
    expect(mockModels.ProjectShowcase.find).toHaveBeenCalledWith(expect.objectContaining({ status: "published" }));
    const match = mockModels.ContributionEvidence.aggregate.mock.calls[0][0][0].$match;
    expect(match).toEqual(expect.objectContaining({ user_id: "user-1", status: "active", public_safe: true }));
  });

  test("short-circuits public proof when the profile is not public", async () => {
    arrange({ profile: false });
    await expect(service.listPublicProfileConnections("user-1")).resolves.toEqual([]);
    expect(mockModels.ProjectParticipant.find).not.toHaveBeenCalled();
  });

  test("requires effective-public Team ancestry and a published showcase on public profiles", async () => {
    arrange({ teams: [], showcases: [] });
    await expect(service.listPublicProfileConnections("user-1")).resolves.toEqual([]);
  });

  test("candidate-self proof uses exact required skill overlap without profile publication opt-in", async () => {
    arrange({ showcases: [] });
    const result = await service.listOpportunityRelevantProof("user-1", {
      required_skill_ids: ["skill-react", "skill-node"],
      preferred_skill_ids: ["skill-css"],
    });

    expect(result.required_skills).toHaveLength(1);
    expect(result.required_skills[0].skill.id).toBe("skill-react");
    expect(result.required_skills[0].projects[0].target_path).toBe("/teams/studio/projects/accessible-work-hub");
    expect(result.project_count).toBe(1);
    expect(result.evidence_count).toBe(1);
    expect(mockModels.ProjectParticipant.find.mock.calls.at(-1)[0]).not.toHaveProperty("show_on_profile");
  });

  test("omits wrong-user, revoked, and non-public-safe evidence at the database boundary", async () => {
    await service.listOpportunityRelevantProof("user-1", { required_skill_ids: ["skill-react"] });
    const match = mockModels.ContributionEvidence.aggregate.mock.calls[0][0][0].$match;
    expect(match).toEqual(expect.objectContaining({
      user_id: "user-1",
      status: "active",
      public_safe: true,
    }));
  });

  test.each(["Opportunity", "public profile"])("unrelated Projects cannot fill the %s proof preview", async (surface) => {
    const projects = Array.from({ length: 13 }, (_, index) => ({
      id: `project-${index}`, team_id: "team-1", name: `Project ${index}`, slug: `project-${index}`,
      skill_ids: [index === 0 ? "skill-react" : "skill-node"], completed_at: new Date(Date.UTC(2026, 9, index + 1)),
    }));
    arrange({
      projects, participants: projects.map((project) => ({ project_id: project.id })),
      showcases: projects.map(({ id }) => ({ project_id: id, status: "published" })),
      evidenceGroups: projects.map(({ id }) => evidenceGroup(id, [baseEvidence({ project_id: id })])),
    });
    const connections = surface === "Opportunity"
      ? (await service.listOpportunityRelevantProof("user-1", { required_skill_ids: ["skill-react"] })).required_skills
      : await service.listPublicProfileConnections("user-1");
    expect(connections[0]?.projects.map((project) => project.id)).toEqual(["project-0"]);
  });

  test("applies deterministic Project ordering and all response caps", async () => {
    const projects = Array.from({ length: 14 }, (_, index) => ({
      id: `project-${String(index + 1).padStart(2, "0")}`,
      team_id: "team-1",
      name: `Project ${index + 1}`,
      slug: `project-${index + 1}`,
      skill_ids: ["skill-react"],
      completed_at: new Date(`2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
    }));
    const participants = projects.map((project) => ({ id: `participant-${project.id}`, project_id: project.id, team_id: "team-1", role: "contributor" }));
    const showcases = projects.map((project) => ({ id: `showcase-${project.id}`, project_id: project.id, status: "published" }));
    const evidenceGroups = projects.map((project) => evidenceGroup(project.id, [baseEvidence({ id: `evidence-${project.id}`, project_id: project.id })]));
    arrange({ projects, participants, showcases, evidenceGroups });

    const result = await service.listPublicProfileConnections("user-1");
    expect(result[0].projects.map((project) => project.id)).toEqual(["project-14", "project-13", "project-12"]);
    const participantQuery = mockModels.ProjectParticipant.find.mock.results[0].value;
    expect(participantQuery.limit).toHaveBeenCalledWith(100);
  });

  test("hasPublicProfileProof delegates to the same strict policy", async () => {
    await expect(service.hasPublicProfileProof("user-1")).resolves.toBe(true);
    arrange({ userSkills: [] });
    await expect(service.hasPublicProfileProof("user-1")).resolves.toBe(true);
    await expect(service.listPublicProfileConnections("user-1")).resolves.toEqual([]);
    arrange({ showcases: [] });
    await expect(service.hasPublicProfileProof("user-1")).resolves.toBe(false);
  });

  test("application proof excludes private Team ancestry and exposes bounded safe facts", async () => {
    arrange();
    const result = await service.listApplicationEligibleProof("user-1");
    expect(result).toEqual([expect.objectContaining({
      id: "project-1",
      participant_role: "contributor",
      team: { name: "Studio", slug: "studio" },
      skills: [{ id: "skill-react", slug: "react", name: "React" }],
      target_path: "/teams/studio/projects/accessible-work-hub",
      evidence_count: 1,
      evidence: [expect.objectContaining({ id: "evidence-1", project_id: "project-1" })],
    })]);
    expect(JSON.stringify(result)).not.toMatch(/metadata|source_key|attachment|task_id/i);

    arrange({ teams: [] });
    await expect(service.listApplicationEligibleProof("user-1")).resolves.toEqual([]);
  });
});
