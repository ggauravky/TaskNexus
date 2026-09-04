const {
  normalizeUsername,
  normalizeProfileInput,
  normalizeSkillAssignments,
  normalizeEducationInput,
  calculateCompleteness,
} = require("../src/domain/professionalProfile");

describe("Phase 2 professional profile domain", () => {
  test.each([
    ["Aria_Dev", "aria_dev"],
    ["builder-42", "builder-42"],
  ])("normalizes valid username %s", (input, expected) => {
    expect(normalizeUsername(input, { required: true })).toBe(expected);
  });

  test.each(["admin", "profile", "tasknexus", "u"])("rejects reserved username %s", (username) => {
    expect(() => normalizeUsername(username, { required: true })).toThrow("reserved");
  });

  test.each(["2fast", "ab", "space name", "bad.name"])("rejects invalid username %s", (username) => {
    expect(() => normalizeUsername(username, { required: true })).toThrow();
  });

  test("rejects unsafe URL protocols and credentials", () => {
    expect(() => normalizeProfileInput({ portfolioUrl: "javascript:alert(1)" })).toThrow("HTTPS");
    expect(() => normalizeProfileInput({ githubUrl: "https://user:pass@example.com" })).toThrow("HTTPS");
    expect(normalizeProfileInput({ githubUrl: "https://github.com/aria" }).githubUrl).toBe("https://github.com/aria");
  });

  test("rejects mass assignment fields", () => {
    expect(() => normalizeProfileInput({ email: "takeover@example.com", visibility: "public" })).toThrow("Unsupported profile field");
  });

  test("validates profile enum arrays and deduplicates values", () => {
    const result = normalizeProfileInput({
      interests: ["open_source", "open_source", "accessibility"],
      preferredRoles: ["builder", "reviewer"],
      timezone: "Asia/Kolkata",
    });
    expect(result.interests).toEqual(["open_source", "accessibility"]);
    expect(() => normalizeProfileInput({ interests: ["winning"] })).toThrow("supported");
  });

  test("skill assignments reject duplicates and enforce the primary limit", () => {
    const ids = Array.from({ length: 6 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
    expect(() => normalizeSkillAssignments([
      { skillId: ids[0] }, { skillId: ids[0] },
    ])).toThrow("Duplicate");
    expect(() => normalizeSkillAssignments(ids.map((skillId) => ({ skillId, isPrimary: true })))).toThrow("at most 5");
  });

  test("education validates year ordering and current-study semantics", () => {
    expect(normalizeEducationInput({
      institution: "National Institute of Technology",
      degreeCourse: "B.Tech",
      fieldOfStudy: "Computer Science",
      startYear: 2020,
      endYear: 2024,
    })).toMatchObject({ startYear: 2020, endYear: 2024 });
    expect(() => normalizeEducationInput({
      institution: "Institute", degreeCourse: "Course", startYear: 2024, endYear: 2020,
    })).toThrow("endYear");
    expect(() => normalizeEducationInput({
      institution: "Institute", degreeCourse: "Course", startYear: 2024,
      endYear: 2026, currentlyStudying: true,
    })).toThrow("Current education");
  });

  test("completeness is deterministic and describes missing sections", () => {
    const result = calculateCompleteness({
      user: { profile: { firstName: "Aria", lastName: "Nair" } },
      profile: { username: "aria", headline: "Frontend engineer", bio: "x".repeat(80) },
      skills: [],
      education: [],
    });
    expect(result).toEqual(expect.objectContaining({ percentage: 40, completed: 4, total: 10 }));
    expect(result.missing).toContain("skills");
  });
});
