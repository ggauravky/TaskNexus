const {
  PROOF_DISCLAIMER,
  proofConnectionDto,
  proofEvidenceDto,
  proofProjectDto,
  relevantProofDto,
} = require("../src/serializers/proofSerializers");

const evidence = {
  id: "evidence-1",
  project_id: "project-1",
  evidence_type: "github_pull_request",
  verification_level: "external_verified",
  title: "Improve accessible task tabs",
  source_url: "https://github.com/example/repo/pull/12",
  source_key: "private-dedupe-key",
  summary: "private detail",
  metadata: { task_id: "task-1" },
  attachments: [{ id: "attachment-1" }],
  occurred_at: new Date("2026-09-30T00:00:00.000Z"),
};

describe("Phase E factual proof DTOs", () => {
  test("allowlists public evidence and preserves the factual verification state", () => {
    expect(proofEvidenceDto(evidence, { includeProjectId: true })).toEqual({
      id: "evidence-1",
      project_id: "project-1",
      type: "github_pull_request",
      verification: "external_verified",
      title: "Improve accessible task tabs",
      source_url: "https://github.com/example/repo/pull/12",
      occurred_at: new Date("2026-09-30T00:00:00.000Z"),
    });
  });

  test("does not publish source URLs for internal or generic evidence", () => {
    expect(proofEvidenceDto({
      ...evidence,
      evidence_type: "project_task_completion",
      verification_level: "internal_verified",
      title: "Private task title",
      source_url: "https://tasknexus.example/tasks/private",
    })).toEqual({
      id: "evidence-1",
      type: "project_task_completion",
      verification: "internal_verified",
      title: "Completed project work",
      source_url: null,
      occurred_at: new Date("2026-09-30T00:00:00.000Z"),
    });

    expect(proofEvidenceDto({
      ...evidence,
      evidence_type: "external_link",
      verification_level: "unverified",
      source_url: "https://example.com/private-proof",
    }).source_url).toBeNull();
  });

  test("builds a safe Project proof card with flat deterministic counts", () => {
    const result = proofProjectDto({
      id: "project-1",
      name: "Accessible work hub",
      slug: "accessible-work-hub",
      completed_at: new Date("2026-10-01T00:00:00.000Z"),
      description: "not part of proof",
    }, {
      team: { name: "Studio", slug: "studio", visibility: "public" },
      targetPath: "/showcase/studio/accessible-work-hub",
      evidenceRows: [
        evidence,
        { ...evidence, id: "evidence-2", evidence_type: "external_link", verification_level: "unverified" },
      ],
      evidencePreviewRows: [evidence],
    });

    expect(result).toEqual({
      id: "project-1",
      name: "Accessible work hub",
      completed_at: new Date("2026-10-01T00:00:00.000Z"),
      team: { name: "Studio", slug: "studio" },
      target_path: "/showcase/studio/accessible-work-hub",
      evidence_summary: {
        total: 2,
        internal_verified: 0,
        external_verified: 1,
        unverified: 1,
      },
      evidence: [{
        id: "evidence-1",
        type: "github_pull_request",
        verification: "external_verified",
        title: "Improve accessible task tabs",
        source_url: "https://github.com/example/repo/pull/12",
        occurred_at: new Date("2026-09-30T00:00:00.000Z"),
      }],
    });
    expect(JSON.stringify(result)).not.toMatch(/description|metadata|source_key|attachment|task_id/i);
  });

  test("rejects unsafe navigation targets instead of echoing them", () => {
    const result = proofProjectDto({ id: "project-1", name: "Project" }, {
      team: { name: "Studio", slug: "studio" },
      targetPath: "https://evil.example/steal",
      evidenceRows: [],
      evidencePreviewRows: [],
    });
    expect(result.target_path).toBeNull();
  });

  test("groups projects by a canonical skill without endorsements or opaque scores", () => {
    const project = proofProjectDto({ id: "project-1", name: "Project" }, {
      team: { name: "Studio", slug: "studio" },
      targetPath: "/teams/studio/projects/project",
      evidenceRows: [evidence],
      evidencePreviewRows: [],
    });
    const result = proofConnectionDto({ id: "skill-1", slug: "react", name: "React", proficiency: "expert" }, [project]);

    expect(result).toEqual({
      skill: { id: "skill-1", slug: "react", name: "React" },
      projects: [project],
    });
    expect(JSON.stringify(result)).not.toMatch(/score|rank|endorsement|proficiency/i);
  });

  test("counts unique Projects and their full eligible evidence only once", () => {
    const project = proofProjectDto({ id: "project-1", name: "Project" }, {
      team: { name: "Studio", slug: "studio" },
      targetPath: "/teams/studio/projects/project",
      evidenceRows: [evidence, { ...evidence, id: "evidence-2", verification_level: "internal_verified" }],
      evidencePreviewRows: [evidence],
    });
    const connections = [
      proofConnectionDto({ id: "skill-1", slug: "react", name: "React" }, [project]),
      proofConnectionDto({ id: "skill-2", slug: "node", name: "Node.js" }, [project]),
    ];

    expect(relevantProofDto(connections)).toEqual({
      required_skills: connections,
      project_count: 1,
      evidence_count: 2,
      disclaimer: PROOF_DISCLAIMER,
    });
  });

  test("returns a stable empty relevant-proof shape", () => {
    expect(relevantProofDto([])).toEqual({
      required_skills: [],
      project_count: 0,
      evidence_count: 0,
      disclaimer: PROOF_DISCLAIMER,
    });
  });
});
