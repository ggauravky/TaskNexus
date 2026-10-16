const queryResult = (rows = []) => {
  const query = {};
  query.select = jest.fn(() => query);
  query.sort = jest.fn(() => query);
  query.limit = jest.fn(() => query);
  query.lean = jest.fn(async () => rows);
  return query;
};

const mockModels = {
  Team: { find: jest.fn() },
  TeamMembership: {},
  TeamActivity: {},
  TeamInvitation: {},
  TeamJoinRequest: {},
  User: { find: jest.fn() },
  UserProfile: { aggregate: jest.fn() },
  UserSkill: {},
  Skill: {},
  Project: { aggregate: jest.fn() },
  ProjectActivity: {},
  ProjectMilestone: {},
  ProjectParticipant: {},
  ProjectTask: {},
  ContributionEvidence: {},
  ProjectShowcase: {},
  UserBlock: {},
  Hackathon: { find: jest.fn() },
  HackathonActivity: {},
  HackathonParticipant: {},
  HackathonSubmission: {},
  HackathonTeam: {},
  Notification: {},
  Opportunity: { find: jest.fn() },
  Organization: { find: jest.fn() },
  OrganizationMembership: {},
  OpportunityCandidateState: {},
  NativeApplication: {},
  Task: { find: jest.fn() },
};

jest.mock("../src/models", () => mockModels);

const teamService = require("../src/services/teamService");
const projectService = require("../src/services/projectService");
const discoveryService = require("../src/services/discoveryService");
const hackathonService = require("../src/services/hackathonService");
const opportunityService = require("../src/services/opportunityService");
const taskService = require("../src/services/taskService");

describe("bounded global search domain adapters", () => {
  beforeEach(() => jest.clearAllMocks());

  test("team search is public, projected, deterministic, lean, and capped", async () => {
    const query = queryResult([{ _id: "team-1", name: "React Builders", slug: "react-builders", tagline: "Public", status: "active" }]);
    mockModels.Team.find.mockReturnValue(query);

    const result = await teamService.searchTeams("react");

    expect(mockModels.Team.find).toHaveBeenCalledWith(expect.objectContaining({ visibility: "public", status: "active", $or: expect.anything() }));
    expect(query.select).toHaveBeenCalledWith("_id name slug tagline status");
    expect(query.sort).toHaveBeenCalledWith({ updated_at: -1, _id: 1 });
    expect(query.limit).toHaveBeenCalledWith(5);
    expect(query.lean).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: "team-1", type: "team", title: "React Builders", subtitle: "Public", status: "active", targetPath: "/teams/react-builders" }]);
  });

  test("project search requires an effective-public project and public active parent before limiting", async () => {
    mockModels.Project.aggregate.mockResolvedValue([{ _id: "project-1", name: "React App", slug: "react-app", tagline: "Open", status: "active", team_slug: "react-builders" }]);

    const result = await projectService.searchProjects("react");
    const pipeline = mockModels.Project.aggregate.mock.calls[0][0];

    expect(pipeline[0]).toEqual({ $match: expect.objectContaining({ visibility: "public", status: expect.anything(), $or: expect.anything() }) });
    expect(pipeline).toEqual(expect.arrayContaining([
      expect.objectContaining({ $lookup: expect.objectContaining({ from: "teams" }) }),
      { $sort: { updated_at: -1, _id: 1 } },
      { $limit: 5 },
      { $project: expect.objectContaining({ _id: 1, name: 1, slug: 1, team_slug: expect.anything() }) },
    ]));
    expect(JSON.stringify(pipeline)).toContain('"visibility":"public"');
    expect(JSON.stringify(pipeline)).toContain('"status":"active"');
    expect(result[0].targetPath).toBe("/teams/react-builders/projects/react-app");
  });

  test("people search applies public discovery, active-account, self, and both-direction block predicates in Mongo", async () => {
    mockModels.UserProfile.aggregate.mockResolvedValue([{ _id: "person-1", username: "react-dev", headline: "Builder", display_name: "React Dev" }]);

    const result = await discoveryService.searchPeople("react", { id: "viewer-1", role: "client" });
    const pipeline = mockModels.UserProfile.aggregate.mock.calls[0][0];
    const encoded = JSON.stringify(pipeline);

    expect(pipeline[0]).toEqual({ $match: expect.objectContaining({ visibility: "public", discoverable: true, _id: expect.anything(), $or: expect.anything() }) });
    expect(encoded).toContain('"user.status":"active"');
    expect(encoded).toContain('"user_blocks"');
    expect(encoded).toContain('"$limit":5');
    expect(encoded).toContain('"$project"');
    expect(encoded).not.toContain("email");
    expect(encoded).not.toContain("evidence");
    expect(result).toEqual([{ id: "person-1", type: "person", title: "React Dev", subtitle: "Builder", targetPath: "/u/react-dev" }]);
  });

  test("hackathon search preserves ordinary and administrator visibility without participation expansion", async () => {
    const ordinaryQuery = queryResult([]);
    const adminQuery = queryResult([]);
    mockModels.Hackathon.find.mockReturnValueOnce(ordinaryQuery).mockReturnValueOnce(adminQuery);

    await hackathonService.searchHackathons("react", { id: "user-1", role: "client" });
    await hackathonService.searchHackathons("react", { id: "admin-1", role: "admin" });

    expect(mockModels.Hackathon.find.mock.calls[0][0]).toEqual(expect.objectContaining({ visibility: "public", status: expect.anything(), $or: expect.anything() }));
    expect(mockModels.Hackathon.find.mock.calls[1][0]).toEqual(expect.objectContaining({ visibility: expect.anything(), status: expect.anything(), $or: expect.anything() }));
    for (const query of [ordinaryQuery, adminQuery]) {
      expect(query.select).toHaveBeenCalledWith("_id name slug tagline organizer_name status");
      expect(query.sort).toHaveBeenCalledWith({ event_start: 1, _id: 1 });
      expect(query.limit).toHaveBeenCalledWith(5);
    }
  });

  test("opportunity and organization searches use catalog predicates, projections, and fixed limits", async () => {
    const opportunityQuery = queryResult([{ _id: "opp-1", title: "React Engineer", slug: "react-engineer", summary: "Build", status: "published" }]);
    const organizationQuery = queryResult([{ _id: "org-1", name: "React Labs", slug: "react-labs", tagline: "Open", status: "active" }]);
    mockModels.Opportunity.find.mockReturnValue(opportunityQuery);
    mockModels.Organization.find.mockReturnValue(organizationQuery);

    const [opportunities, organizations] = await Promise.all([
      opportunityService.searchOpportunities("react"),
      opportunityService.searchOrganizations("react"),
    ]);

    expect(mockModels.Opportunity.find).toHaveBeenCalledWith(expect.objectContaining({ status: "published", $and: expect.anything() }));
    expect(mockModels.Organization.find).toHaveBeenCalledWith(expect.objectContaining({ status: "active", $or: expect.anything() }));
    for (const query of [opportunityQuery, organizationQuery]) {
      expect(query.select).toHaveBeenCalled();
      expect(query.sort).toHaveBeenCalled();
      expect(query.limit).toHaveBeenCalledWith(5);
      expect(query.lean).toHaveBeenCalledTimes(1);
    }
    expect(opportunities[0].type).toBe("opportunity");
    expect(organizations[0].type).toBe("organization");
  });

  test.each([
    [{ id: "client-1", role: "client" }, { client_id: "client-1" }],
    [{ id: "freelancer-1", role: "freelancer" }, { freelancer_id: "freelancer-1" }],
  ])("marketplace task search uses the strict participant predicate for %j", async (viewer, expectedFilter) => {
    const query = queryResult([{ _id: "00000000-0000-4000-8000-000000000101", task_details: { title: "React task", description: "Build" }, status: "in_progress" }]);
    mockModels.Task.find.mockReturnValue(query);

    const result = await taskService.searchMarketplaceTasks("react", viewer);

    expect(mockModels.Task.find).toHaveBeenCalledWith(expect.objectContaining(expectedFilter));
    expect(query.select).toHaveBeenCalledWith("_id task_details.title task_details.description status updated_at");
    expect(query.sort).toHaveBeenCalledWith({ updated_at: -1, _id: 1 });
    expect(query.limit).toHaveBeenCalledWith(5);
    expect(result[0]).toEqual(expect.objectContaining({ type: "marketplace_task", targetPath: "/tasks/00000000-0000-4000-8000-000000000101" }));
  });

  test("administrator task search remains database-index anchored and bounded", async () => {
    const query = queryResult([]);
    mockModels.Task.find.mockReturnValue(query);

    await taskService.searchMarketplaceTasks("react", { id: "admin-1", role: "admin" });

    expect(mockModels.Task.find).toHaveBeenCalledWith(expect.objectContaining({ status: expect.anything(), "task_details.title": expect.anything() }));
    expect(query.limit).toHaveBeenCalledWith(5);
    expect(mockModels.ProjectTask).not.toHaveProperty("find", expect.anything());
  });
});

describe("global search orchestration", () => {
  test("starts all seven domain searches together and returns stable capped serialized groups", async () => {
    const deferred = [];
    const start = (service, method, row) => jest.spyOn(service, method).mockImplementation(() => new Promise((resolve) => {
      deferred.push(() => resolve(Array.from({ length: 7 }, (_, index) => ({ ...row, id: `${row.id}-${index}` }))));
    }));
    start(teamService, "searchTeams", { id: "team", type: "team", title: "Team", targetPath: "/teams/team" });
    start(projectService, "searchProjects", { id: "project", type: "project", title: "Project", targetPath: "/teams/team/projects/project" });
    start(discoveryService, "searchPeople", { id: "person", type: "person", title: "Person", targetPath: "/u/person" });
    start(hackathonService, "searchHackathons", { id: "hackathon", type: "hackathon", title: "Hackathon", targetPath: "/hackathons/hackathon" });
    start(opportunityService, "searchOpportunities", { id: "opportunity", type: "opportunity", title: "Opportunity", targetPath: "/opportunities/opportunity" });
    start(opportunityService, "searchOrganizations", { id: "organization", type: "organization", title: "Organization", targetPath: "/organizations/organization" });
    start(taskService, "searchMarketplaceTasks", { id: "task", type: "marketplace_task", title: "Task", targetPath: "/tasks/00000000-0000-4000-8000-000000000101" });
    const searchService = require("../src/services/searchService");
    const viewer = { id: "viewer-1", role: "client" };

    const pending = searchService.search({ query: "react", viewer });
    expect(deferred).toHaveLength(7);
    deferred.forEach((resolve) => resolve());
    const result = await pending;

    expect(Object.keys(result.groups)).toEqual(["teams", "projects", "people", "hackathons", "opportunities", "organizations", "tasks"]);
    expect(Object.values(result.groups).every((items) => items.length === 5)).toBe(true);
    expect(Object.values(result.groups).flat().every((row) => Object.keys(row).every((key) => ["id", "type", "title", "subtitle", "status", "target_path"].includes(key)))).toBe(true);
    for (const [service, method] of [
      [teamService, "searchTeams"], [projectService, "searchProjects"], [discoveryService, "searchPeople"],
      [hackathonService, "searchHackathons"], [opportunityService, "searchOpportunities"],
      [opportunityService, "searchOrganizations"], [taskService, "searchMarketplaceTasks"],
    ]) expect(service[method]).toHaveBeenCalledWith("react", viewer);
  });
});
