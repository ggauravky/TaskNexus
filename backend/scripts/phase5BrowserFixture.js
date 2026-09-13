require("../src/config/loadEnv");
require("./lib/stagingSafety").assertStagingMutationAllowed();
const { randomBytes, randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const slug = "phase5-browser-qa";
const projectSlug = "evidence-showcase";
const password = `Tn-QA-${randomBytes(18).toString("base64url")}9aA!`;
const emails = ["phase5-owner@example.invalid", "phase5-contributor@example.invalid", "phase5-team-only@example.invalid"];

const cleanup = async () => {
  const team = await models.Team.findOne({ slug }).lean();
  const users = await models.User.find({ email: mongoose.trusted({ $in: emails }) }).select("_id").lean();
  const userIds = users.map((row) => String(row._id));
  if (team) {
    const teamId = String(team._id);
    const projects = await models.Project.find({ team_id: teamId }).select("_id").lean();
    const projectIds = projects.map((row) => String(row._id));
    const inProjects = mongoose.trusted({ $in: projectIds });
    await Promise.all([
      models.ProjectShowcase.deleteMany({ project_id: inProjects }), models.ProjectRepository.deleteMany({ project_id: inProjects }),
      models.ContributionEvidence.deleteMany({ project_id: inProjects }), models.ProjectActivity.deleteMany({ project_id: inProjects }),
      models.ProjectTask.deleteMany({ project_id: inProjects }), models.ProjectMilestone.deleteMany({ project_id: inProjects }),
      models.ProjectParticipant.deleteMany({ project_id: inProjects }), models.Notification.deleteMany({ entity_id: inProjects }),
    ]);
    await models.Project.deleteMany({ team_id: teamId });
    await Promise.all([
      models.TeamActivity.deleteMany({ team_id: teamId }), models.TeamInvitation.deleteMany({ team_id: teamId }),
      models.TeamJoinRequest.deleteMany({ team_id: teamId }), models.TeamMembership.deleteMany({ team_id: teamId }),
    ]);
    await models.Team.deleteOne({ _id: teamId });
  }
  if (userIds.length) {
    const inUsers = mongoose.trusted({ $in: userIds });
    await Promise.all([
      models.UserProfile.deleteMany({ _id: inUsers }), models.UserSkill.deleteMany({ user_id: inUsers }),
      models.UserEducation.deleteMany({ user_id: inUsers }), models.AuditLog.deleteMany({ user_id: inUsers }),
      models.Notification.deleteMany({ recipient_id: inUsers }),
    ]);
    await models.User.deleteMany({ _id: inUsers });
  }
};

const setup = async () => {
  await cleanup();
  const ids = { owner: randomUUID(), contributor: randomUUID(), teamOnly: randomUUID(), team: randomUUID(), project: randomUUID(), task: randomUUID(), repository: randomUUID() };
  const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS) || 12);
  await models.User.insertMany([
    { _id: ids.owner, email: emails[0], password: hash, role: "client", profile: { firstName: "Avery", lastName: "Owner" }, status: "active" },
    { _id: ids.contributor, email: emails[1], password: hash, role: "freelancer", profile: { firstName: "Mira", lastName: "Contributor" }, status: "active" },
    { _id: ids.teamOnly, email: emails[2], password: hash, role: "client", profile: { firstName: "Taylor", lastName: "Member" }, status: "active" },
  ]);
  await models.UserProfile.insertMany([
    { _id: ids.owner, username: "phase5-avery", headline: "Collaboration lead", visibility: "public", onboarding_completed: true },
    { _id: ids.contributor, username: "phase5-mira", headline: "Systems contributor", visibility: "public", github_url: "https://github.com/octocat", onboarding_completed: true },
    { _id: ids.teamOnly, username: "phase5-taylor", headline: "Team observer", visibility: "public", onboarding_completed: true },
  ]);
  await models.Team.create({ _id: ids.team, name: "Phase Five Studio", slug, tagline: "Evidence-first collaboration", description: "Browser QA fixture", created_by: ids.owner, owner_id: ids.owner, visibility: "public", join_policy: "invite_only", status: "active" });
  await models.TeamMembership.insertMany([
    { _id: randomUUID(), team_id: ids.team, user_id: ids.owner, role: "owner", status: "active" },
    { _id: randomUUID(), team_id: ids.team, user_id: ids.contributor, role: "member", status: "active" },
    { _id: randomUUID(), team_id: ids.team, user_id: ids.teamOnly, role: "member", status: "active" },
  ]);
  await models.Project.create({ _id: ids.project, team_id: ids.team, name: "Evidence Showcase", slug: projectSlug, tagline: "Inspectable proof without opaque scores", description: "An internal description that must stay in the workspace.", status: "completed", visibility: "public", created_by: ids.owner, completed_at: new Date(), tags: ["evidence", "portfolio"] });
  await models.ProjectParticipant.insertMany([
    { _id: randomUUID(), team_id: ids.team, project_id: ids.project, user_id: ids.owner, role: "lead", status: "active", show_on_profile: true },
    { _id: randomUUID(), team_id: ids.team, project_id: ids.project, user_id: ids.contributor, role: "contributor", status: "active", show_on_profile: true },
  ]);
  await models.ProjectTask.create({ _id: ids.task, team_id: ids.team, project_id: ids.project, title: "Private browser QA task", description: "Never public", status: "done", priority: "high", created_by: ids.owner, assignee_ids: [ids.owner, ids.contributor], completed_at: new Date(), revision: 3 });
  const evidence = [
    { _id: randomUUID(), user_id: ids.owner, title: "Contributed to completed task", source_key: `task:${ids.task}:owner`, verification_level: "internal_verified", evidence_type: "project_task_completion", origin: "system", task_id: ids.task, public_safe: false },
    { _id: randomUUID(), user_id: ids.contributor, title: "Contributed to completed task", source_key: `task:${ids.task}:contributor`, verification_level: "internal_verified", evidence_type: "project_task_completion", origin: "system", task_id: ids.task, public_safe: false },
    { _id: randomUUID(), user_id: ids.contributor, title: "Document evidence boundaries", source_key: "github_commit:octocat/hello-world:7fd1a60", verification_level: "external_verified", evidence_type: "github_commit", origin: "user", repository_id: ids.repository, provider: "github", provider_ref: "7fd1a60b01f91b314f59955a4e4d4e80d8edf11d", source_url: "https://github.com/octocat/Hello-World/commit/7fd1a60b01f91b314f59955a4e4d4e80d8edf11d", public_safe: true },
  ].map((item) => ({ ...item, team_id: ids.team, project_id: ids.project, created_by: item.user_id, status: "active", occurred_at: new Date(), verified_at: new Date() }));
  await models.ContributionEvidence.insertMany(evidence);
  await models.ProjectRepository.create({ _id: ids.repository, team_id: ids.team, project_id: ids.project, provider: "github", owner: "octocat", repository: "Hello-World", owner_key: "octocat", repository_key: "hello-world", canonical_url: "https://github.com/octocat/Hello-World", added_by: ids.owner, verification_status: "verified", verified_at: new Date() });
  await models.ProjectShowcase.create({ _id: randomUUID(), team_id: ids.team, project_id: ids.project, status: "published", headline: "Proof that stays connected to the work", summary: "A public project story built from inspectable evidence, explicit verification, and careful privacy boundaries.", problem: "Contribution claims lose meaning when context and provenance disappear.", solution: "TaskNexus records internal facts separately from GitHub verification and manual claims.", outcome: "Teams can publish a credible case study without ranking collaborators or exposing their private workspace.", featured_evidence_ids: evidence.map((item) => item._id), featured_skills: ["MongoDB", "React", "API design"], created_by: ids.owner, updated_by: ids.owner, published_at: new Date(), revision: 1 });
  process.stdout.write(JSON.stringify({ url: `http://localhost:5173/showcase/${slug}/${projectSlug}`, projectUrl: `http://localhost:5173/teams/${slug}/projects/${projectSlug}`, editorUrl: `http://localhost:5173/teams/${slug}/projects/${projectSlug}/showcase`, credentials: { owner: { email: emails[0], password }, contributor: { email: emails[1], password }, teamOnly: { email: emails[2], password } } }, null, 2));
};

const run = async () => { await connectDatabase(); try { if (process.argv[2] === "cleanup") { await cleanup(); process.stdout.write("Phase 5 browser fixture cleaned.\n"); } else await setup(); } finally { await disconnectDatabase(); } };
run().catch((error) => { process.stderr.write(`Phase 5 browser fixture failed: ${error.stack || error.message}\n`); process.exitCode = 1; }).finally(disconnectDatabase);
