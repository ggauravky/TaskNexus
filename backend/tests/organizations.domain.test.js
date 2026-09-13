const domain = require("../../shared/contracts/domain.json");
const contracts = require("../src/contracts/domain");
const {
  ApplicationActivity, NativeApplication, Opportunity, OrganizationInvitation, OrganizationMembership,
} = require("../src/models");
const { organizationPermissions, applicantDetailDto, candidateApplicationDto, invitationDto, memberDto } = require("../src/serializers/organizationSerializers");
const { _private } = require("../src/services/nativeApplicationService");

const IDS = {
  org: "90000000-0000-4000-8000-000000000001", opportunity: "90000000-0000-4000-8000-000000000002",
  user: "90000000-0000-4000-8000-000000000003", other: "90000000-0000-4000-8000-000000000004",
  application: "90000000-0000-4000-8000-000000000005", project: "90000000-0000-4000-8000-000000000006",
  evidence: "90000000-0000-4000-8000-000000000007",
};

const snapshot = (overrides = {}) => ({
  display_name: "Mira Sen", username: "mira", headline: "Platform engineer", avatar_url: "https://cdn.example.com/mira.png",
  education: [{ institution: "Example University", degree_course: "B.Tech", field_of_study: "Computer Science", end_year: 2027 }],
  skills: [{ id: IDS.evidence, name: "JavaScript", slug: "javascript", proficiency: "advanced" }], projects: [], evidence: [], ...overrides,
});
const application = (overrides = {}) => new NativeApplication({
  _id: IDS.application, opportunity_id: IDS.opportunity, organization_id: IDS.org, candidate_id: IDS.user,
  stage: "submitted", submitted_profile_snapshot: snapshot(), selected_project_ids: [], selected_evidence_ids: [], ...overrides,
});
const nativeOpportunity = (overrides = {}) => new Opportunity({
  _id: IDS.opportunity, organization_id: IDS.org, type: "internship", title: "Platform Intern", slug: "platform-intern",
  work_mode: "remote", application_mode: "tasknexus", application_url: null, source_type: "organization_owned",
  status: "draft", created_by: IDS.user, ...overrides,
});
const hasIndex = (Model, keys, options = {}) => Model.schema.indexes().some(([actual, config]) => JSON.stringify(actual) === JSON.stringify(keys) && Object.entries(options).every(([key, value]) => JSON.stringify(config[key]) === JSON.stringify(value)));

describe("Phase 9 canonical contracts", () => {
  test("adds contextual Organization roles without changing global account roles", () => {
    expect(domain.userRoles).toEqual(["client", "freelancer", "admin"]);
    expect(Object.values(contracts.ORGANIZATION_ROLE)).toEqual(["owner", "admin", "recruiter"]);
  });
  test("defines distinct external and TaskNexus application modes", () => expect(Object.values(contracts.OPPORTUNITY_APPLICATION_MODE)).toEqual(["external", "tasknexus"]));
  test("defines a bounded terminal application lifecycle", () => {
    expect(domain.nativeApplicationStages).toEqual(["submitted", "reviewing", "shortlisted", "assessment", "interview", "offer", "rejected", "withdrawn"]);
    expect(domain.nativeApplicationTransitions.offer).toEqual([]); expect(domain.nativeApplicationTransitions.rejected).toEqual([]); expect(domain.nativeApplicationTransitions.withdrawn).toEqual([]);
    expect([..._private.WITHDRAWABLE_STAGES]).toEqual(["submitted", "reviewing", "shortlisted", "assessment", "interview"]);
  });
  test("adds only Phase 9 notification vocabulary", () => expect(domain.notificationTypes).toEqual(expect.arrayContaining(["organization_invitation", "native_application_received", "application_stage_changed", "application_withdrawn"])));
});

describe("Phase 9 Organization authorization matrix", () => {
  test("owner has all Organization management permissions", () => expect(organizationPermissions("owner")).toEqual(expect.objectContaining({ view_workspace: true, manage_members: true, create_opportunities: true, change_application_stage: true, transfer_ownership: true, archive_management: true })));
  test("admin can manage recruiters but cannot transfer ownership", () => expect(organizationPermissions("admin")).toEqual(expect.objectContaining({ manage_members: true, invite_members: true, transfer_ownership: false, archive_management: false })));
  test("recruiter can operate hiring workflows but not Organization authority", () => expect(organizationPermissions("recruiter")).toEqual(expect.objectContaining({ view_workspace: true, create_opportunities: true, view_applicants: true, change_application_stage: true, edit_organization: false, manage_members: false })));
  test("outsider has no contextual permissions", () => expect(Object.values(organizationPermissions(null)).every((value) => value === false)).toBe(true));
});

describe("Phase 9 MongoDB models and invariants", () => {
  test("accepts owner, admin, and recruiter memberships but rejects invented roles", async () => {
    for (const role of domain.organizationRoles) await expect(new OrganizationMembership({ organization_id: IDS.org, user_id: IDS.user, role }).validate()).resolves.toBeUndefined();
    await expect(new OrganizationMembership({ organization_id: IDS.org, user_id: IDS.user, role: "hiring_manager" }).validate()).rejects.toThrow();
  });
  test("bounds Organization invitation roles and content", async () => {
    await expect(new OrganizationInvitation({ organization_id: IDS.org, invited_user_id: IDS.other, invited_by: IDS.user, role: "recruiter", message: "Join us" }).validate()).resolves.toBeUndefined();
    await expect(new OrganizationInvitation({ organization_id: IDS.org, invited_user_id: IDS.other, invited_by: IDS.user, role: "owner" }).validate()).rejects.toThrow();
  });
  test("accepts a safe bounded application snapshot", async () => await expect(application().validate()).resolves.toBeUndefined());
  test("rejects unknown stages, overlong cover notes, and oversized project selections", async () => {
    await expect(application({ stage: "hired" }).validate()).rejects.toThrow();
    await expect(application({ cover_note: "x".repeat(2001) }).validate()).rejects.toThrow();
    await expect(application({ selected_project_ids: Array.from({ length: 6 }, (_, index) => `${index}`) }).validate()).rejects.toThrow();
  });
  test("requires external URLs and permits URL-free TaskNexus-native Opportunities", async () => {
    await expect(nativeOpportunity().validate()).resolves.toBeUndefined();
    await expect(nativeOpportunity({ application_mode: "external", source_type: "external" }).validate()).rejects.toThrow("application URL");
  });
  test("prevents non-Organization sources from enabling TaskNexus apply", async () => await expect(nativeOpportunity({ source_type: "official" }).validate()).rejects.toThrow("Organization-owned"));
  test("validates immutable application activity vocabulary", async () => {
    await expect(new ApplicationActivity({ application_id: IDS.application, organization_id: IDS.org, actor_id: IDS.user, type: "submitted", to_stage: "submitted" }).validate()).resolves.toBeUndefined();
    await expect(new ApplicationActivity({ application_id: IDS.application, organization_id: IDS.org, actor_id: IDS.user, type: "viewed", to_stage: "submitted" }).validate()).rejects.toThrow();
  });
  test("declares membership, owner, invitation, application, and activity race indexes", () => {
    expect(hasIndex(OrganizationMembership, { organization_id: 1, user_id: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(OrganizationMembership, { organization_id: 1, role: 1, status: 1 }, { unique: true, partialFilterExpression: { role: "owner", status: "active" } })).toBe(true);
    expect(hasIndex(OrganizationInvitation, { organization_id: 1, invited_user_id: 1 }, { unique: true, partialFilterExpression: { status: "pending" } })).toBe(true);
    expect(hasIndex(NativeApplication, { opportunity_id: 1, candidate_id: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(NativeApplication, { organization_id: 1, stage: 1, submitted_at: -1 })).toBe(true);
    expect(hasIndex(ApplicationActivity, { application_id: 1, created_at: 1 })).toBe(true);
  });
});

describe("Phase 9 privacy and DTO boundaries", () => {
  test("candidate DTO never exposes candidate identity, snapshot, cover note, email, or phone", () => {
    const row = { ...application().toObject(), id: IDS.application, email: "private@example.com", phone: "+1000000" };
    const dto = candidateApplicationDto(row);
    expect(dto).not.toHaveProperty("candidate_id"); expect(dto).not.toHaveProperty("submitted_profile_snapshot"); expect(dto).not.toHaveProperty("cover_note");
    expect(JSON.stringify(dto)).not.toContain("private@example.com");
  });
  test("recruiter applicant DTO exposes only the consented snapshot", () => {
    const row = { ...application({ cover_note: "I consent to this note" }).toObject(), id: IDS.application, email: "private@example.com", saved_opportunities: [IDS.opportunity] };
    const dto = applicantDetailDto(row);
    expect(dto.candidate.display_name).toBe("Mira Sen"); expect(dto.cover_note).toBe("I consent to this note");
    expect(JSON.stringify(dto)).not.toContain("private@example.com"); expect(dto).not.toHaveProperty("candidate_id");
  });
  test("membership and invitation DTOs omit raw persistence and unrelated account fields", () => {
    expect(memberDto({ id: "m", organization_id: IDS.org, user_id: IDS.user, role: "recruiter", status: "active" }, { display_name: "Mira" })).not.toHaveProperty("email");
    expect(invitationDto({ id: "i", organization_id: IDS.org, invited_user_id: IDS.other, invited_by: IDS.user, role: "recruiter", status: "pending" })).not.toHaveProperty("__v");
  });
  test("application input enforces UUIDs, bounds, and deduplication", () => {
    expect(_private.idList([IDS.project, IDS.project], 5, "Projects")).toEqual([IDS.project]);
    expect(() => _private.idList(["$ne"], 5, "Projects")).toThrow("invalid");
    expect(() => _private.idList(Array(6).fill(0).map((_, index) => `90000000-0000-4000-8000-00000000001${index}`), 5, "Projects")).toThrow("excessive");
  });
});
