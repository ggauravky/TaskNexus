require("../src/config/loadEnv");
const assert = require("assert/strict");
const crypto = require("crypto");

const apiBase = (process.argv[2] || "http://localhost:5054/api").replace(/\/$/, "");
const suffix = crypto.randomUUID().replace(/-/g, "");
const email = `phase2-live-${suffix}@staging.invalid`;
const password = `Tn-${crypto.randomBytes(18).toString("base64url")}9aA`;

const call = async (path, { method = "GET", token, body } = {}) => {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  return { status: response.status, payload };
};

const main = async () => {
  const registration = await call("/auth/register", {
    method: "POST",
    body: {
      email,
      password,
      role: "freelancer",
      profile: { firstName: "Mira", lastName: "Sen" },
    },
  });
  assert.equal(registration.status, 201);
  const token = registration.payload.data.accessToken;
  const userId = registration.payload.data.user.id;
  assert.ok(token);

  const ownBefore = await call("/profile", { token });
  assert.equal(ownBefore.status, 200);
  assert.equal(ownBefore.payload.data.account.id, userId);
  assert.equal(ownBefore.payload.data.profile.visibility, "private");

  const reserved = await call("/profile/username?username=admin", { token });
  assert.equal(reserved.status, 400);
  const username = `mira-${suffix.slice(0, 12)}`;
  const availability = await call(`/profile/username?username=${username.toUpperCase()}`, { token });
  assert.equal(availability.status, 200);
  assert.equal(availability.payload.data.available, true);
  assert.equal(availability.payload.data.username, username);

  const saved = await call("/profile", {
    method: "PUT",
    token,
    body: {
      firstName: "Mira",
      lastName: "Sen",
      username,
      headline: "Frontend systems engineer",
      bio: "I build maintainable web platforms, accessible component systems, and pragmatic delivery workflows for distributed product teams.",
      location: "Bengaluru, India",
      timezone: "Asia/Kolkata",
      availability: "open",
      collaborationCommitment: "few_hours",
      githubUrl: "https://github.com/example",
      linkedinUrl: "https://www.linkedin.com/in/example",
      portfolioUrl: "https://example.com/work",
      interests: ["open_source", "accessibility", "developer_tools"],
      preferredRoles: ["builder", "reviewer"],
      visibility: "public",
    },
  });
  assert.equal(saved.status, 200);

  const catalog = await call("/public/skills?q=react.js&limit=12");
  assert.equal(catalog.status, 200);
  assert.ok(catalog.payload.data.length >= 1);
  assert.ok(catalog.payload.data.length <= 12);
  const selected = catalog.payload.data.slice(0, 2);
  const skillSave = await call("/profile/skills", {
    method: "PUT",
    token,
    body: { skills: selected.map((skill, index) => ({ skillId: skill.id, proficiency: index ? "intermediate" : "advanced", isPrimary: index === 0 })) },
  });
  assert.equal(skillSave.status, 200);
  assert.equal(skillSave.payload.data.length, selected.length);

  const duplicateSkill = await call("/profile/skills", {
    method: "PUT",
    token,
    body: { skills: [
      { skillId: selected[0].id, proficiency: "advanced", isPrimary: true },
      { skillId: selected[0].id, proficiency: "beginner", isPrimary: false },
    ] },
  });
  assert.equal(duplicateSkill.status, 400);

  const education = await call("/profile/education", {
    method: "POST",
    token,
    body: {
      institution: "National Institute of Technology",
      degreeCourse: "B.Tech",
      fieldOfStudy: "Computer Science",
      startYear: 2018,
      endYear: 2022,
    },
  });
  assert.equal(education.status, 201);
  const foreignEducation = await call("/profile/education/00000000-0000-4000-8000-000000000999", {
    method: "PUT",
    token,
    body: { institution: "Other", degreeCourse: "Other", startYear: 2020 },
  });
  assert.equal(foreignEducation.status, 404);

  const onboarding = await call("/profile/onboarding", {
    method: "PUT",
    token,
    body: { username, visibility: "public" },
  });
  assert.equal(onboarding.status, 200);
  assert.equal(onboarding.payload.data.profile.onboardingCompleted, true);

  const publicResult = await call(`/public/profiles/${username}`);
  assert.equal(publicResult.status, 200);
  const publicText = JSON.stringify(publicResult.payload.data);
  [email, "phone", "password", "refresh_token", "hourlyRate", "status"].forEach((privateValue) => {
    assert.equal(publicText.includes(privateValue), false);
  });
  assert.equal(publicResult.payload.data.skills.length, selected.length);
  assert.equal(publicResult.payload.data.education.length, 1);

  const privacySave = await call("/profile", { method: "PUT", token, body: { visibility: "private" } });
  assert.equal(privacySave.status, 200);
  const privateResult = await call(`/public/profiles/${username}`);
  assert.equal(privateResult.status, 404);

  process.stdout.write(JSON.stringify({
    userId,
    checks: {
      registration: true,
      ownProfile: true,
      reservedUsername: true,
      usernameNormalization: true,
      structuredSkills: true,
      duplicateSkillRejection: true,
      educationOwnership: true,
      onboarding: true,
      publicDtoPrivacy: true,
      privateVisibility: true,
    },
  }));
};

main().catch((error) => {
  process.stderr.write(`${error.stack}\n`);
  process.exitCode = 1;
});
