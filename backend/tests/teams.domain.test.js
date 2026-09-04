const domain = require("../../shared/contracts/domain.json");
const contracts = require("../src/contracts/domain");
const {
  Team, TeamActivity, TeamInvitation, TeamJoinRequest, TeamMembership,
} = require("../src/models");
const { teamPermissions } = require("../src/serializers/teamSerializers");
const { canManageMember } = require("../src/services/teamAuthorization");

const IDS = {
  team: "10000000-0000-4000-8000-000000000001",
  owner: "10000000-0000-4000-8000-000000000002",
  member: "10000000-0000-4000-8000-000000000003",
};

const hasIndex = (Model, keys, options = {}) => Model.schema.indexes().some(([actualKeys, actualOptions]) => (
  JSON.stringify(actualKeys) === JSON.stringify(keys)
  && Object.entries(options).every(([key, value]) => actualOptions[key] === value)
));

describe("Phase 3 canonical team contracts", () => {
  test("backend team enums are generated from the shared contract", () => {
    expect(Object.values(contracts.TEAM_VISIBILITY)).toEqual(domain.teamVisibilities);
    expect(Object.values(contracts.TEAM_JOIN_POLICY)).toEqual(domain.teamJoinPolicies);
    expect(Object.values(contracts.TEAM_ROLE)).toEqual(domain.teamRoles);
    expect(Object.values(contracts.TEAM_INVITATION_STATUS)).toEqual(domain.teamInvitationStatuses);
    expect(Object.values(contracts.TEAM_JOIN_REQUEST_STATUS)).toEqual(domain.teamJoinRequestStatuses);
  });

  test("team notification types remain in the shared notification enum", () => {
    expect(Object.values(contracts.TEAM_NOTIFICATION_TYPES)).toEqual(expect.arrayContaining([
      "team_invitation", "team_join_request", "team_ownership_transferred",
    ]));
  });
});

describe("Phase 3 MongoDB model validation", () => {
  test("normalizes valid slugs and rejects reserved or unsafe slugs", async () => {
    const team = new Team({ _id: IDS.team, name: "Neural Nexus", slug: "Neural-Nexus", created_by: IDS.owner, owner_id: IDS.owner });
    await expect(team.validate()).resolves.toBeUndefined();
    expect(team.slug).toBe("neural-nexus");
    await expect(new Team({ name: "Reserved", slug: "teams", created_by: IDS.owner, owner_id: IDS.owner }).validate()).rejects.toThrow("reserved");
    await expect(new Team({ name: "Unsafe", slug: "bad slug", created_by: IDS.owner, owner_id: IDS.owner }).validate()).rejects.toThrow();
  });

  test("validates privacy, join policy, role, and state enums", async () => {
    await expect(new Team({ name: "Invalid team", slug: "invalid-team", created_by: IDS.owner, owner_id: IDS.owner, visibility: "secret", join_policy: "followers" }).validate()).rejects.toThrow();
    await expect(new TeamMembership({ team_id: IDS.team, user_id: IDS.member, role: "moderator", status: "invited" }).validate()).rejects.toThrow();
    await expect(new TeamInvitation({ team_id: IDS.team, invited_user_id: IDS.member, invited_by: IDS.owner, status: "waiting" }).validate()).rejects.toThrow();
    await expect(new TeamJoinRequest({ team_id: IDS.team, user_id: IDS.member, status: "waiting" }).validate()).rejects.toThrow();
    await expect(new TeamActivity({ team_id: IDS.team, actor_id: IDS.owner, type: "api_called" }).validate()).rejects.toThrow();
  });

  test("bounds plain team collaboration messages", async () => {
    await expect(new TeamInvitation({ team_id: IDS.team, invited_user_id: IDS.member, invited_by: IDS.owner, message: "x".repeat(501) }).validate()).rejects.toThrow();
    await expect(new TeamJoinRequest({ team_id: IDS.team, user_id: IDS.member, message: "x".repeat(501) }).validate()).rejects.toThrow();
  });
});

describe("Phase 3 database index contracts", () => {
  test("declares slug, membership, pending-state, and one-owner uniqueness", () => {
    expect(hasIndex(Team, { slug: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(TeamMembership, { team_id: 1, user_id: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(TeamMembership, { team_id: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(TeamInvitation, { team_id: 1, invited_user_id: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(TeamJoinRequest, { team_id: 1, user_id: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(TeamActivity, { team_id: 1, created_at: -1 })).toBe(true);
  });
});

describe("contextual team permission matrix", () => {
  test("global account roles never appear in the team permission input", () => {
    expect(teamPermissions("client")).toEqual(expect.objectContaining({ edit_team: false, invite_members: false, transfer_ownership: false }));
    expect(teamPermissions("freelancer")).toEqual(expect.objectContaining({ edit_team: false, invite_members: false, transfer_ownership: false }));
  });

  test("owner, admin, and member permissions match the documented matrix", () => {
    expect(teamPermissions("owner")).toEqual(expect.objectContaining({ edit_team: true, manage_roles: true, transfer_ownership: true, archive_team: true }));
    expect(teamPermissions("admin")).toEqual(expect.objectContaining({ edit_team: true, invite_members: true, review_requests: true, manage_roles: false, transfer_ownership: false }));
    expect(teamPermissions("member")).toEqual(expect.objectContaining({ view_members: true, edit_team: false, invite_members: false, remove_members: false }));
  });

  test("member-management hierarchy prevents admin-on-admin and all owner removal", () => {
    expect(canManageMember({ role: "owner" }, { role: "admin" })).toBe(true);
    expect(canManageMember({ role: "admin" }, { role: "member" })).toBe(true);
    expect(canManageMember({ role: "admin" }, { role: "admin" })).toBe(false);
    expect(canManageMember({ role: "owner" }, { role: "owner" })).toBe(false);
  });
});
