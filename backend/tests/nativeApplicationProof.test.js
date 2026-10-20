const mockProofService = {
  listApplicationEligibleProof: jest.fn(),
  loadSelectedApplicationProof: jest.fn(),
};

jest.mock("../src/services/professionalProofService", () => mockProofService);

const nativeApplicationService = require("../src/services/nativeApplicationService");

describe("native application proof delegation", () => {
  beforeEach(() => jest.clearAllMocks());

  test("eligible Projects use the shared caller-owned proof policy", async () => {
    const eligible = [{
      id: "project-1",
      name: "Accessible work hub",
      participant_role: "contributor",
      completed_at: new Date("2026-10-01T00:00:00.000Z"),
      team: { name: "Studio", slug: "studio" },
      skills: [{ id: "skill-react", slug: "react", name: "React" }],
      target_path: "/teams/studio/projects/accessible-work-hub",
      evidence_count: 2,
      evidence: [],
    }];
    mockProofService.listApplicationEligibleProof.mockResolvedValue(eligible);

    await expect(nativeApplicationService.listEligibleProjects("candidate-1")).resolves.toBe(eligible);
    expect(mockProofService.listApplicationEligibleProof).toHaveBeenCalledWith("candidate-1");
  });

  test("snapshot validation delegates exact selections and transaction session", async () => {
    const session = { id: "session-1" };
    const selected = {
      projects: [{ id: "project-1", name: "Project", participant_role: "contributor" }],
      evidence: [{ id: "evidence-2", project_id: "project-1", verification_level: "external_verified" }],
    };
    mockProofService.loadSelectedApplicationProof.mockResolvedValue(selected);

    await expect(nativeApplicationService._private.loadEligibleProjectData(
      "candidate-1",
      ["project-1"],
      ["evidence-2"],
      session,
    )).resolves.toBe(selected);
    expect(mockProofService.loadSelectedApplicationProof).toHaveBeenCalledWith(
      "candidate-1",
      ["project-1"],
      ["evidence-2"],
      session,
    );
  });
});
