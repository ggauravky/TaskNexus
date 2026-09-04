const {
  User, UserProfile, Skill, UserSkill, UserEducation, Task,
} = require("../src/models");
const mongoose = require("mongoose");
const { buildFilter, trustedOperators } = require("../src/data/mongoDataUtils");

const UUIDS = {
  user: "00000000-0000-4000-8000-000000000001",
  skill: "00000000-0000-4000-8000-000000000002",
};

describe("MongoDB model validation", () => {
  test("accepts canonical user identity and rejects invalid email or role", async () => {
    await expect(new User({
      _id: UUIDS.user, email: "member@example.com", password: "hash", role: "client", profile: {},
    }).validate()).resolves.toBeUndefined();
    await expect(new User({
      _id: UUIDS.user, email: "not-an-email", password: "hash", role: "owner", profile: {},
    }).validate()).rejects.toThrow();
  });

  test("normalizes usernames and rejects reserved or malformed values", async () => {
    const profile = new UserProfile({ _id: UUIDS.user, username: "Aria_Dev" });
    await expect(profile.validate()).resolves.toBeUndefined();
    expect(profile.username).toBe("aria_dev");
    await expect(new UserProfile({ _id: UUIDS.user, username: "admin" }).validate()).rejects.toThrow("reserved");
    await expect(new UserProfile({ _id: UUIDS.user, username: "bad.name" }).validate()).rejects.toThrow();
  });

  test("enforces profile enums, bounded arrays, and HTTPS links", async () => {
    await expect(new UserProfile({
      _id: UUIDS.user, visibility: "secret", availability: "sometimes",
      interests: Array(13).fill("open_source"), github_url: "javascript:alert(1)",
    }).validate()).rejects.toThrow();
  });

  test("enforces canonical skills and proficiency", async () => {
    await expect(new Skill({
      _id: UUIDS.skill, slug: "bad slug", name: "Broken", normalized_name: "broken", category: "unknown",
    }).validate()).rejects.toThrow();
    await expect(new UserSkill({
      _id: `${UUIDS.user}:${UUIDS.skill}`, user_id: UUIDS.user, skill_id: UUIDS.skill, proficiency: "expert",
    }).validate()).rejects.toThrow();
  });

  test("enforces education year relationships", async () => {
    await expect(new UserEducation({
      user_id: UUIDS.user, institution: "Institute", degree_course: "Course",
      start_year: 2025, end_year: 2024,
    }).validate()).rejects.toThrow("End year");
    await expect(new UserEducation({
      user_id: UUIDS.user, institution: "Institute", degree_course: "Course",
      start_year: 2024, currently_studying: true, end_year: 2026,
    }).validate()).rejects.toThrow("End year");
  });

  test("enforces task status and priority contracts", async () => {
    await expect(new Task({
      task_id: "TSK-1", client_id: UUIDS.user, task_details: { title: "Task" }, status: "lost", priority: "urgentest",
    }).validate()).rejects.toThrow();
  });
});

describe("MongoDB index contracts", () => {
  const hasIndex = (Model, keys, options = {}) => Model.schema.indexes().some(([actualKeys, actualOptions]) => (
    JSON.stringify(actualKeys) === JSON.stringify(keys)
      && Object.entries(options).every(([key, value]) => actualOptions[key] === value)
  ));

  test("declares database-enforced identity uniqueness", () => {
    expect(hasIndex(User, { email: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(UserProfile, { username: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(Skill, { slug: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(UserSkill, { user_id: 1, skill_id: 1 }, { unique: true })).toBe(true);
  });
});

describe("MongoDB filter safety", () => {
  beforeAll(() => mongoose.set("sanitizeFilter", true));

  test("keeps only application-constructed operators executable", () => {
    const query = Task.find({
      ...buildFilter({ status: ["assigned", "in_progress"] }),
      "task_details.title": trustedOperators({ $regex: "react", $options: "i" }),
    });
    query._castConditions();
    expect(query.getFilter().status.$in).toEqual(["assigned", "in_progress"]);
    expect(query.getFilter()["task_details.title"]).toMatchObject({ $regex: "react", $options: "i" });

    const untrusted = Task.find({ status: { $ne: "blocked" } });
    untrusted._castConditions();
    expect(untrusted.getFilter()).toEqual({ status: { $eq: { $ne: "blocked" } } });
  });
});
