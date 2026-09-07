const domain = require("../../shared/contracts/domain.json");
const contracts = require("../src/contracts/domain");
const {
  Hackathon, HackathonActivity, HackathonParticipant, HackathonSubmission, HackathonTeam,
  TeamOpening, CollaborationRequest,
} = require("../src/models");
const { hackathonDetail, participationDto, submissionDto, teamRegistrationDto } = require("../src/serializers/hackathonSerializers");
const { _private } = require("../src/services/hackathonService");

const IDS = {
  hackathon: "70000000-0000-4000-8000-000000000001",
  user: "70000000-0000-4000-8000-000000000002",
  team: "70000000-0000-4000-8000-000000000003",
  registration: "70000000-0000-4000-8000-000000000004",
  project: "70000000-0000-4000-8000-000000000005",
};

const event = (overrides = {}) => new Hackathon({
  _id: IDS.hackathon, name: "Build for Earth", slug: "build-for-earth", organizer_name: "TaskNexus Labs",
  mode: "hybrid", city: "Bengaluru", event_start: "2027-01-10T09:00:00.000Z", event_end: "2027-01-12T18:00:00.000Z",
  registration_deadline: "2027-01-09T18:00:00.000Z", submission_deadline: "2027-01-12T17:00:00.000Z",
  status: "registration_open", team_min_size: 2, team_max_size: 5, created_by: IDS.user,
  submission_requirements: [{ type: "repository", label: "Repository", required: true }], ...overrides,
});

const hasIndex = (Model, keys, options = {}) => Model.schema.indexes().some(([actualKeys, actualOptions]) => (
  JSON.stringify(actualKeys) === JSON.stringify(keys)
  && Object.entries(options).every(([key, value]) => actualOptions[key] === value)
));

describe("Phase 7 canonical Hackathon contracts", () => {
  test("generates every Hackathon enum from the shared contract", () => {
    expect(Object.values(contracts.HACKATHON_STATUS)).toEqual(domain.hackathonStatuses);
    expect(Object.values(contracts.HACKATHON_MODE)).toEqual(domain.hackathonModes);
    expect(Object.values(contracts.HACKATHON_PARTICIPATION_STATUS)).toEqual(domain.hackathonParticipationStatuses);
    expect(Object.values(contracts.HACKATHON_TEAM_STATUS)).toEqual(domain.hackathonTeamStatuses);
    expect(Object.values(contracts.HACKATHON_SUBMISSION_STATUS)).toEqual(domain.hackathonSubmissionStatuses);
    expect(Object.values(contracts.HACKATHON_REQUIREMENT_TYPE)).toEqual(domain.hackathonRequirementTypes);
  });

  test("adds only explicit Hackathon activity and notification vocabulary", () => {
    expect(domain.hackathonActivityTypes).toEqual(expect.arrayContaining(["team_registered", "project_linked", "submission_submitted"]));
    expect(domain.notificationTypes).toEqual(expect.arrayContaining(["hackathon_team_registered", "hackathon_submission_submitted"]));
  });
});

describe("Phase 7 Hackathon model validation", () => {
  test("accepts the canonical lifecycle, UTC dates, mode, team rules, and requirements", async () => {
    await expect(event().validate()).resolves.toBeUndefined();
  });

  test("rejects unsafe slugs, URLs, enums, date order, and impossible team ranges", async () => {
    await expect(event({ slug: "hackathons" }).validate()).rejects.toThrow("reserved");
    await expect(event({ slug: "Bad Slug" }).validate()).rejects.toThrow();
    await expect(event({ website_url: "http://example.com", mode: "remote-ish" }).validate()).rejects.toThrow();
    await expect(event({ event_end: "2027-01-09T00:00:00.000Z" }).validate()).rejects.toThrow("Event end");
    await expect(event({ submission_deadline: "2027-01-01T00:00:00.000Z" }).validate()).rejects.toThrow("Submission deadline");
    await expect(event({ team_min_size: 6, team_max_size: 4 }).validate()).rejects.toThrow("Maximum team size");
  });

  test("normalizes online events so physical location is not leaked", async () => {
    const online = event({ mode: "online", city: "Remove me", venue: "Remove me too" });
    await online.validate();
    expect(online.city).toBeNull(); expect(online.venue).toBeNull();
  });

  test("bounds participation, registration, submission and activity fields", async () => {
    await expect(new HackathonParticipant({ hackathon_id: IDS.hackathon, user_id: IDS.user, status: "participating", preferred_roles: ["ml_engineer"] }).validate()).resolves.toBeUndefined();
    await expect(new HackathonParticipant({ hackathon_id: IDS.hackathon, user_id: IDS.user, status: "joined", preferred_roles: ["wizard"] }).validate()).rejects.toThrow();
    await expect(new HackathonTeam({ hackathon_id: IDS.hackathon, team_id: IDS.team, registered_by: IDS.user, status: "registered" }).validate()).resolves.toBeUndefined();
    await expect(new HackathonSubmission({ hackathon_id: IDS.hackathon, hackathon_team_id: IDS.registration, team_id: IDS.team, project_id: IDS.project, repository_url: "javascript:alert(1)" }).validate()).rejects.toThrow();
    await expect(new HackathonActivity({ hackathon_id: IDS.hackathon, actor_id: IDS.user, type: "page_view" }).validate()).rejects.toThrow();
  });

  test("extends existing Team Openings and Collaboration Requests with optional context", async () => {
    await expect(new TeamOpening({ team_id: IDS.team, title: "Hackathon backend", role: "backend_developer", created_by: IDS.user, hackathon_id: IDS.hackathon, hackathon_team_id: IDS.registration }).validate()).resolves.toBeUndefined();
    await expect(new CollaborationRequest({ sender_id: IDS.user, recipient_id: IDS.team, context_key: `hackathon:${IDS.hackathon}`, hackathon_id: IDS.hackathon }).validate()).resolves.toBeUndefined();
  });
});

describe("Phase 7 deterministic readiness and deadlines", () => {
  test("reports factual required-item completion without a score", () => {
    const hackathon = event({ submission_requirements: [
      { type: "project_title", label: "Project title", required: true }, { type: "repository", label: "Repository", required: true },
      { type: "demo", label: "Demo", required: false }, { type: "team_confirmed", label: "Confirm team", required: true },
    ] }).toObject();
    const result = _private.buildReadiness(hackathon, { repository_url: "https://github.com/example/repo" }, { name: "Planet Fix" }, true, { checklist: [{ type: "team_confirmed", completed: true }] });
    expect(result.readiness).toEqual({ complete: 3, total: 3, ready: true, missing: [] });
    expect(result).not.toHaveProperty("score");
  });

  test("uses the authoritative server timestamp for registration and submission cutoffs", () => {
    const hackathon = event().toObject();
    expect(() => _private.registrationWritable(hackathon, new Date("2027-01-09T17:59:59.999Z"))).not.toThrow();
    expect(() => _private.registrationWritable(hackathon, new Date("2027-01-09T18:00:00.001Z"))).toThrow("deadline");
    expect(() => _private.submissionWritable(hackathon, new Date("2027-01-12T17:00:00.001Z"))).toThrow("deadline");
  });

  test("keeps safe HTTPS URL validation local and performs no fetch", () => {
    expect(_private.httpsUrl("https://example.com/demo", "Demo URL")).toBe("https://example.com/demo");
    expect(() => _private.httpsUrl("http://127.0.0.1/admin", "Demo URL")).toThrow("HTTPS");
    expect(() => _private.httpsUrl("javascript:alert(1)", "Demo URL")).toThrow("HTTPS");
  });
});

describe("Phase 7 safe DTOs and indexes", () => {
  test("serializers exclude persistence and actor-owned identity fields", () => {
    const hackathon = event().toObject(); hackathon.id = hackathon._id; delete hackathon._id;
    const detail = hackathonDetail(hackathon); const participation = participationDto({ id: "p", hackathon_id: IDS.hackathon, user_id: IDS.user, status: "participating" });
    const registration = teamRegistrationDto({ id: IDS.registration, hackathon_id: IDS.hackathon, team_id: IDS.team, registered_by: IDS.user, status: "registered", revision: 0 });
    const submission = submissionDto({ id: "s", hackathon_id: IDS.hackathon, hackathon_team_id: IDS.registration, team_id: IDS.team, project_id: IDS.project, submitted_by: IDS.user, status: "draft", revision: 0 });
    expect(JSON.stringify({ detail, participation, registration, submission })).not.toContain("created_by");
    expect(participation).not.toHaveProperty("user_id");
    expect(registration).not.toHaveProperty("registered_by");
    expect(submission).not.toHaveProperty("submitted_by");
  });

  test("declares all query and race-critical indexes", () => {
    expect(hasIndex(Hackathon, { slug: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(Hackathon, { visibility: 1, status: 1, event_start: 1 })).toBe(true);
    expect(hasIndex(HackathonParticipant, { hackathon_id: 1, user_id: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(HackathonParticipant, { hackathon_id: 1, looking_for_team: 1, status: 1, updated_at: -1 })).toBe(true);
    expect(hasIndex(HackathonTeam, { hackathon_id: 1, team_id: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(HackathonSubmission, { hackathon_team_id: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(HackathonActivity, { hackathon_id: 1, created_at: -1 })).toBe(true);
    expect(hasIndex(TeamOpening, { hackathon_id: 1, status: 1, created_at: -1 })).toBe(true);
    expect(hasIndex(CollaborationRequest, { hackathon_id: 1, status: 1, created_at: -1 })).toBe(true);
  });
});
