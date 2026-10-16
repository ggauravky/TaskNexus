const {
  SEARCH_GROUPS,
  SEARCH_RESULT_LIMIT,
  buildSearchTarget,
  normalizeSearchQuery,
  serializeSearchResult,
} = require("../src/serializers");

describe("global search contracts", () => {
  test("normalizes two-to-eighty character text", () => {
    expect(normalizeSearchQuery("  react   builders  ")).toBe("react builders");
    expect(normalizeSearchQuery("x".repeat(80))).toBe("x".repeat(80));
  });

  test.each([
    undefined,
    null,
    "",
    "   ",
    "x",
    "x".repeat(81),
    ["react"],
    { q: "react" },
  ])("rejects invalid search input %#", (value) => {
    expect(() => normalizeSearchQuery(value)).toThrow("Search query must be between 2 and 80 characters");
  });

  test("keeps a stable seven-group order and fixed result limit", () => {
    expect(SEARCH_GROUPS).toEqual([
      "teams",
      "projects",
      "people",
      "hackathons",
      "opportunities",
      "organizations",
      "tasks",
    ]);
    expect(SEARCH_RESULT_LIMIT).toBe(5);
  });

  test.each([
    ["team", { slug: "react-builders" }, "/teams/react-builders"],
    ["project", { teamSlug: "react-builders", slug: "task-nexus" }, "/teams/react-builders/projects/task-nexus"],
    ["person", { username: "ada-lovelace" }, "/u/ada-lovelace"],
    ["hackathon", { slug: "build-week" }, "/hackathons/build-week"],
    ["opportunity", { slug: "senior-builder" }, "/opportunities/senior-builder"],
    ["organization", { slug: "open-labs" }, "/organizations/open-labs"],
    ["marketplace_task", { taskId: "00000000-0000-4000-8000-000000000101" }, "/tasks/00000000-0000-4000-8000-000000000101"],
  ])("builds an explicit safe target for %s", (type, identifiers, expected) => {
    expect(buildSearchTarget(type, identifiers)).toBe(expected);
  });

  test.each([
    ["team", { slug: "../../admin" }],
    ["project", { teamSlug: "valid", slug: "javascript:alert" }],
    ["person", { username: "name\\escape" }],
    ["marketplace_task", { taskId: "not-a-uuid" }],
    ["unknown", { slug: "valid" }],
  ])("omits malformed targets for %s", (type, identifiers) => {
    expect(buildSearchTarget(type, identifiers)).toBeNull();
  });

  test("serializes only the common safe DTO", () => {
    expect(serializeSearchResult({
      id: "team-1",
      type: "team",
      title: "React Builders",
      subtitle: "Public team",
      status: "active",
      targetPath: "/teams/react-builders",
      email: "private@example.com",
      evidence: [{ id: "private" }],
    })).toEqual({
      id: "team-1",
      type: "team",
      title: "React Builders",
      subtitle: "Public team",
      status: "active",
      target_path: "/teams/react-builders",
    });
  });

  test("omits optional fields and rejects unsafe or unsupported rows", () => {
    expect(serializeSearchResult({
      id: "task-1",
      type: "marketplace_task",
      title: "Task",
      targetPath: "/tasks/00000000-0000-4000-8000-000000000101",
    })).toEqual({
      id: "task-1",
      type: "marketplace_task",
      title: "Task",
      target_path: "/tasks/00000000-0000-4000-8000-000000000101",
    });
    expect(serializeSearchResult({ id: "x", type: "team", title: "X", targetPath: "https://evil.example" })).toBeNull();
    expect(serializeSearchResult({ id: "x", type: "project_task", title: "X", targetPath: "/tasks/x" })).toBeNull();
  });
});
