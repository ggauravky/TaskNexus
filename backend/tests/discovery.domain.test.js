const domain = require("../../shared/contracts/domain.json");
const contracts = require("../src/contracts/domain");
const { CollaborationRequest, TeamOpening, UserBlock, UserProfile } = require("../src/models");
const { normalizeProfileInput } = require("../src/domain/professionalProfile");
const { parsePeopleQuery } = require("../src/services/discoveryService");
const { requestDto } = require("../src/services/collaborationRequestService");

const IDS = {
  team: "60000000-0000-4000-8000-000000000001",
  opening: "60000000-0000-4000-8000-000000000002",
  sender: "60000000-0000-4000-8000-000000000003",
  recipient: "60000000-0000-4000-8000-000000000004",
};

const hasIndex = (Model, keys, options = {}) => Model.schema.indexes().some(([actualKeys, actualOptions]) => (
  JSON.stringify(actualKeys) === JSON.stringify(keys)
  && Object.entries(options).every(([key, value]) => actualOptions[key] === value)
));

describe("Phase 6 canonical discovery contracts", () => {
  test("opening and request states are generated from the shared contract", () => {
    expect(Object.values(contracts.TEAM_OPENING_STATUS)).toEqual(domain.teamOpeningStatuses);
    expect(Object.values(contracts.COLLABORATION_REQUEST_STATUS)).toEqual(domain.collaborationRequestStatuses);
    expect(domain.notificationTypes).toEqual(expect.arrayContaining([
      "collaboration_request_received", "collaboration_request_accepted", "team_opening_interest",
    ]));
  });

  test("profile interests and collaboration roles have one canonical vocabulary", () => {
    expect(Object.values(contracts.PROFILE_INTEREST)).toEqual(domain.profileInterests);
    expect(Object.values(contracts.COLLABORATION_ROLE)).toEqual(domain.collaborationRoles);
  });
});

describe("Phase 6 privacy and validation", () => {
  test("discoverability defaults off and requires a boolean at the domain boundary", async () => {
    const profile = new UserProfile({ _id: IDS.sender });
    await expect(profile.validate()).resolves.toBeUndefined();
    expect(profile.discoverable).toBe(false);
    expect(profile.collaboration_revision).toBe(0);
    expect(() => normalizeProfileInput({ discoverable: "true" })).toThrow("discoverable must be a boolean");
    expect(normalizeProfileInput({ discoverable: true })).toEqual({ discoverable: true });
  });

  test("opening and request fields are bounded by canonical values", async () => {
    await expect(new TeamOpening({ team_id: IDS.team, title: "Backend collaborator", role: "backend_developer", created_by: IDS.sender }).validate()).resolves.toBeUndefined();
    await expect(new TeamOpening({ team_id: IDS.team, title: "Bad role", role: "wizard", created_by: IDS.sender }).validate()).rejects.toThrow();
    await expect(new CollaborationRequest({ sender_id: IDS.sender, recipient_id: IDS.recipient, context_key: "general", status: "waiting" }).validate()).rejects.toThrow();
    await expect(new CollaborationRequest({ sender_id: IDS.sender, recipient_id: IDS.recipient, context_key: "general", message: "x".repeat(501) }).validate()).rejects.toThrow();
  });

  test("request DTO excludes persistence keys and private account data", () => {
    const dto = requestDto({ id: "request", sender_id: IDS.sender, recipient_id: IDS.recipient, context_key: "secret", message: null, status: "pending" });
    expect(dto).not.toHaveProperty("context_key");
    expect(dto).not.toHaveProperty("sender_id");
    expect(JSON.stringify(dto)).not.toContain("email");
  });
});

describe("Phase 6 deterministic filtering and indexes", () => {
  test("skill semantics are explicit and default to ALL", () => {
    expect(parsePeopleQuery({ skills: `${IDS.sender},${IDS.recipient}` }).skillMode).toBe("all");
    expect(parsePeopleQuery({ skillMode: "any" }).skillMode).toBe("any");
    expect(parsePeopleQuery({ availability: "open,limited", roles: "backend_developer" })).toEqual(expect.objectContaining({
      availability: ["open", "limited"], roles: ["backend_developer"], limit: 18,
    }));
  });

  test("unknown structured filters fail closed", () => {
    expect(() => parsePeopleQuery({ roles: "$where" })).toThrow("Unsupported role");
    expect(() => parsePeopleQuery({ availability: "unavailable" })).toThrow("Unsupported availability");
  });

  test("declares discovery, opening, request, duplicate, and block indexes", () => {
    expect(hasIndex(UserProfile, { discoverable: 1, visibility: 1, availability: 1, updated_at: -1 })).toBe(true);
    expect(hasIndex(TeamOpening, { status: 1, role: 1, created_at: -1 })).toBe(true);
    expect(hasIndex(CollaborationRequest, { recipient_id: 1, status: 1, created_at: -1 })).toBe(true);
    expect(hasIndex(CollaborationRequest, { sender_id: 1, recipient_id: 1, context_key: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(UserBlock, { blocker_id: 1, blocked_user_id: 1 }, { unique: true })).toBe(true);
  });
});
