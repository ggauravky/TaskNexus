const {
  deriveClientOnboarding,
  deriveFreelancerOnboarding,
} = require("../src/domain/onboarding");

const TASK_ID = "00000000-0000-4000-8000-000000000301";
const SECOND_TASK_ID = "00000000-0000-4000-8000-000000000302";

const facts = (overrides = {}) => ({
  name: false,
  username: false,
  headline: false,
  bio: false,
  locationAndTimezone: false,
  availability: false,
  skills: false,
  ...overrides,
});

describe("Phase D onboarding domain", () => {
  test("new client sees only identity and first-task requirements", () => {
    const result = deriveClientOnboarding({ profileFacts: facts(), tasks: [] });

    expect(result).toMatchObject({
      role: "client",
      isComplete: false,
      completedCount: 0,
      totalCount: 2,
    });
    expect(result.items.map(({ id, applicable, complete }) => ({ id, applicable, complete }))).toEqual([
      { id: "client_identity", applicable: true, complete: false },
      { id: "create_marketplace_task", applicable: true, complete: false },
      { id: "track_first_task", applicable: false, complete: false },
      { id: "review_first_delivery", applicable: false, complete: false },
    ]);
  });

  test("client progression uses assignment, start, and successful approval facts", () => {
    const assigned = {
      id: TASK_ID,
      freelancer_id: "00000000-0000-4000-8000-000000000399",
      status: "assigned",
      workflow: { assignedAt: "2026-10-20T08:00:00.000Z" },
      updated_at: "2026-10-20T08:00:00.000Z",
    };
    const assignedResult = deriveClientOnboarding({
      profileFacts: facts({ name: true, username: true }),
      tasks: [assigned],
    });
    expect(assignedResult.items.find((item) => item.id === "track_first_task")).toMatchObject({
      applicable: true,
      complete: false,
      action: { targetPath: `/tasks/${TASK_ID}?tab=work` },
    });

    const startedResult = deriveClientOnboarding({
      profileFacts: facts({ name: true, username: true }),
      tasks: [{ ...assigned, status: "in_progress", workflow: { ...assigned.workflow, startedAt: "2026-10-20T09:00:00.000Z" } }],
    });
    expect(startedResult.isComplete).toBe(true);

    const deliveredResult = deriveClientOnboarding({
      profileFacts: facts({ name: true, username: true }),
      tasks: [{ ...assigned, status: "delivered", workflow: { ...assigned.workflow, startedAt: "2026-10-20T09:00:00.000Z", deliveredAt: "2026-10-20T10:00:00.000Z" } }],
    });
    expect(deliveredResult.items.find((item) => item.id === "review_first_delivery")).toMatchObject({
      applicable: true,
      complete: false,
      action: { targetPath: `/tasks/${TASK_ID}?tab=delivery` },
    });

    const approvedResult = deriveClientOnboarding({
      profileFacts: facts({ name: true, username: true }),
      tasks: [{ ...assigned, status: "completed", workflow: { ...assigned.workflow, startedAt: "2026-10-20T09:00:00.000Z", completedAt: "2026-10-20T11:00:00.000Z" } }],
    });
    expect(approvedResult.items.find((item) => item.id === "review_first_delivery")).toMatchObject({ applicable: true, complete: true });
    expect(approvedResult.isComplete).toBe(true);
  });

  test("client task targets choose the newest valid marketplace task and reject malformed ids", () => {
    const result = deriveClientOnboarding({
      profileFacts: facts({ name: true, username: true }),
      tasks: [
        { id: TASK_ID, status: "assigned", freelancer_id: "f", workflow: { assignedAt: "x" }, updated_at: "2026-10-19T00:00:00Z" },
        { id: SECOND_TASK_ID, status: "assigned", freelancer_id: "f", workflow: { assignedAt: "x" }, updated_at: "2026-10-20T00:00:00Z" },
      ],
    });
    expect(result.items.find((item) => item.id === "track_first_task").action.targetPath).toBe(`/tasks/${SECOND_TASK_ID}?tab=work`);

    const malformed = deriveClientOnboarding({
      profileFacts: facts({ name: true, username: true }),
      tasks: [{ id: "javascript:alert(1)", status: "assigned", freelancer_id: "f", workflow: { assignedAt: "x" } }],
    });
    expect(malformed.items.find((item) => item.id === "track_first_task").action.targetPath).toBe("/client/dashboard?view=tasks");
  });

  test.each(["open", "limited", "unavailable"])("canonical availability %s never gates freelancer completion", (availability) => {
    const result = deriveFreelancerOnboarding({
      profileFacts: facts({
        name: true,
        username: true,
        headline: true,
        bio: true,
        locationAndTimezone: true,
        availability: availability !== "unavailable",
        skills: true,
      }),
      availability,
      tasks: [{ id: TASK_ID, status: "completed", freelancer_id: "self", workflow: { assignedAt: "x", completedAt: "y" } }],
      hasPublicProof: false,
    });

    expect(result.isComplete).toBe(true);
    expect(result.items.some((item) => item.id === "professional_availability")).toBe(false);
    expect(result.optionalItems).toEqual([]);
  });

  test("freelancer requirements use canonical fundamentals and skills, not legacy fields", () => {
    const result = deriveFreelancerOnboarding({
      profileFacts: facts({ name: true, username: true, headline: true, bio: true, locationAndTimezone: true }),
      availability: "unavailable",
      tasks: [],
      legacyFreelancerProfile: { availability: "available", skills: ["React"] },
    });

    expect(result.items.map(({ id, complete, applicable }) => ({ id, complete, applicable }))).toEqual([
      { id: "profile_fundamentals", complete: true, applicable: true },
      { id: "canonical_skill", complete: false, applicable: true },
      { id: "first_marketplace_assignment", complete: false, applicable: true },
      { id: "complete_marketplace_work", complete: false, applicable: false },
    ]);
    expect(result.totalCount).toBe(3);
  });

  test("freelancer work and optional proof are progressive and proof never affects completion", () => {
    const base = {
      profileFacts: facts({ name: false, username: true, headline: true, bio: true, locationAndTimezone: true, skills: true }),
      availability: "unavailable",
      tasks: [{ id: TASK_ID, status: "completed", freelancer_id: "self", workflow: { assignedAt: "x", completedAt: "y" } }],
    };
    const withoutProof = deriveFreelancerOnboarding({ ...base, hasPublicProof: false });
    const withProof = deriveFreelancerOnboarding({ ...base, hasPublicProof: true });

    expect(withoutProof.isComplete).toBe(false);
    expect(withoutProof.completedCount).toBe(withProof.completedCount);
    expect(withoutProof.totalCount).toBe(withProof.totalCount);
    expect(withoutProof.optionalItems.map((item) => [item.id, item.complete])).toEqual([
      ["review_professional_availability", true],
      ["publish_public_safe_proof", false],
    ]);
    expect(withProof.optionalItems.find((item) => item.id === "publish_public_safe_proof").complete).toBe(true);
  });

  test("removing a required canonical skill makes completed freelancer onboarding reappear", () => {
    const base = {
      name: true,
      username: true,
      headline: true,
      bio: true,
      locationAndTimezone: true,
    };
    const tasks = [{ id: TASK_ID, status: "completed", freelancer_id: "self", workflow: { assignedAt: "x", completedAt: "y" } }];
    expect(deriveFreelancerOnboarding({ profileFacts: facts({ ...base, skills: true }), availability: "unavailable", tasks }).isComplete).toBe(true);
    expect(deriveFreelancerOnboarding({ profileFacts: facts({ ...base, skills: false }), availability: "unavailable", tasks }).isComplete).toBe(false);
  });
});
