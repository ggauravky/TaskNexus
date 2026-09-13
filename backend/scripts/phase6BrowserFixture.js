require("../src/config/loadEnv");
require("./lib/stagingSafety").assertStagingMutationAllowed();
const { randomBytes, randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const teamSlug = "phase6-browser-qa";
const projectSlug = "discovery-proof";
const password = `Tn-QA-${randomBytes(18).toString("base64url")}9aA!`;
const labels = ["owner", "admin", "react", "python", "designer", "private"];
const emails = Object.fromEntries(labels.map((label) => [label, `phase6-${label}@example.invalid`]));
const trustedIn = (values) => mongoose.trusted({ $in: values });

const cleanup = async () => {
  const users = await models.User.find({ email: trustedIn(Object.values(emails)) }).select("_id").lean();
  const userIds = users.map((row) => String(row._id));
  const team = await models.Team.findOne({ slug: teamSlug }).select("_id").lean();
  const teamIds = team ? [String(team._id)] : [];
  const projects = teamIds.length ? await models.Project.find({ team_id: trustedIn(teamIds) }).select("_id").lean() : [];
  const projectIds = projects.map((row) => String(row._id));
  const openings = teamIds.length ? await models.TeamOpening.find({ team_id: trustedIn(teamIds) }).select("_id").lean() : [];
  const openingIds = openings.map((row) => String(row._id));
  if (userIds.length || teamIds.length || projectIds.length || openingIds.length) {
    await Promise.all([
      models.Notification.deleteMany({ $or: mongoose.trusted([{ recipient_id: trustedIn(userIds) }, { actor_id: trustedIn(userIds) }, { entity_id: trustedIn([...teamIds, ...projectIds, ...openingIds]) }]) }),
      models.CollaborationRequest.deleteMany({ $or: mongoose.trusted([{ sender_id: trustedIn(userIds) }, { recipient_id: trustedIn(userIds) }, { team_id: trustedIn(teamIds) }]) }),
      models.UserBlock.deleteMany({ $or: mongoose.trusted([{ blocker_id: trustedIn(userIds) }, { blocked_user_id: trustedIn(userIds) }]) }),
      models.TeamOpening.deleteMany({ team_id: trustedIn(teamIds) }),
      models.ProjectShowcase.deleteMany({ project_id: trustedIn(projectIds) }),
      models.ProjectRepository.deleteMany({ project_id: trustedIn(projectIds) }),
      models.ContributionEvidence.deleteMany({ project_id: trustedIn(projectIds) }),
      models.ProjectActivity.deleteMany({ project_id: trustedIn(projectIds) }),
      models.ProjectTask.deleteMany({ project_id: trustedIn(projectIds) }),
      models.ProjectMilestone.deleteMany({ project_id: trustedIn(projectIds) }),
      models.ProjectParticipant.deleteMany({ project_id: trustedIn(projectIds) }),
      models.TeamActivity.deleteMany({ team_id: trustedIn(teamIds) }),
      models.TeamInvitation.deleteMany({ team_id: trustedIn(teamIds) }),
      models.TeamJoinRequest.deleteMany({ team_id: trustedIn(teamIds) }),
      models.TeamMembership.deleteMany({ team_id: trustedIn(teamIds) }),
      models.UserSkill.deleteMany({ user_id: trustedIn(userIds) }),
      models.UserEducation.deleteMany({ user_id: trustedIn(userIds) }),
      models.AuditLog.deleteMany({ user_id: trustedIn(userIds) }),
    ]);
    await models.Project.deleteMany({ _id: trustedIn(projectIds) });
    await models.Team.deleteMany({ _id: trustedIn(teamIds) });
    await models.UserProfile.deleteMany({ _id: trustedIn(userIds) });
    await models.User.deleteMany({ _id: trustedIn(userIds) });
  }
};

const setup = async () => {
  await cleanup();
  const ids = Object.fromEntries([...labels, "team", "opening", "project", "task", "showcase"].map((label) => [label, randomUUID()]));
  const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS) || 12);
  const names = { owner: ["Nora", "Owner"], admin: ["Arun", "Admin"], react: ["Mira", "React"], python: ["Priya", "Python"], designer: ["Lena", "Design"], private: ["Pavel", "Private"] };
  await models.User.insertMany(labels.map((label) => ({
    _id: ids[label], email: emails[label], password: hash, role: label === "owner" ? "client" : "freelancer",
    profile: { firstName: names[label][0], lastName: names[label][1] }, status: "active",
  })));
  await models.UserProfile.insertMany([
    { _id: ids.owner, username: "phase6-nora", headline: "Product-minded Team lead", visibility: "public", discoverable: true, availability: "open", collaboration_commitment: "few_hours", preferred_roles: ["project_lead"], interests: ["developer_tools"], onboarding_completed: true },
    { _id: ids.admin, username: "phase6-arun", headline: "Backend systems administrator", visibility: "public", discoverable: true, availability: "open", collaboration_commitment: "few_hours", preferred_roles: ["backend_developer"], interests: ["developer_tools"], onboarding_completed: true },
    { _id: ids.react, username: "phase6-mira", headline: "React and Node.js product builder", visibility: "public", discoverable: true, availability: "open", collaboration_commitment: "part_time", preferred_roles: ["full_stack_developer", "frontend_developer"], interests: ["developer_tools"], github_url: "https://github.com/octocat", onboarding_completed: true },
    { _id: ids.python, username: "phase6-priya", headline: "Python machine-learning engineer", visibility: "public", discoverable: true, availability: "limited", collaboration_commitment: "few_hours", preferred_roles: ["ml_engineer"], interests: ["ai_ml"], onboarding_completed: true },
    { _id: ids.designer, username: "phase6-lena", headline: "Accessible interface designer", visibility: "public", discoverable: true, availability: "open", collaboration_commitment: "few_hours", preferred_roles: ["ui_ux_designer", "frontend_developer"], interests: ["design_systems"], onboarding_completed: true },
    { _id: ids.private, username: "phase6-pavel", headline: "Private profile fixture", visibility: "private", discoverable: false, availability: "open", preferred_roles: ["backend_developer"], interests: ["developer_tools"], onboarding_completed: true },
  ]);
  const skills = await models.Skill.find({ slug: trustedIn(["react", "node-js", "mongodb", "python", "machine-learning", "ui-ux-design", "automated-testing", "project-management"]) }).lean();
  const skillBySlug = new Map(skills.map((row) => [row.slug, String(row._id)]));
  const assignments = {
    owner: ["project-management"], admin: ["node-js", "mongodb"], react: ["react", "node-js", "mongodb"],
    python: ["python", "machine-learning"], designer: ["react", "ui-ux-design"], private: ["node-js"],
  };
  await models.UserSkill.insertMany(labels.flatMap((label) => assignments[label].map((slug, index) => ({
    _id: randomUUID(), user_id: ids[label], skill_id: skillBySlug.get(slug), proficiency: "advanced", is_primary: index < 2,
  }))));
  await models.Team.create({ _id: ids.team, name: "Phase Six Guild", slug: teamSlug, tagline: "Transparent teammate discovery", description: "Disposable browser QA Team", created_by: ids.owner, owner_id: ids.owner, visibility: "public", join_policy: "invite_only", primary_interests: ["developer_tools"], status: "active" });
  await models.TeamMembership.insertMany([
    { _id: randomUUID(), team_id: ids.team, user_id: ids.owner, role: "owner", status: "active" },
    { _id: randomUUID(), team_id: ids.team, user_id: ids.admin, role: "admin", status: "active" },
  ]);
  await models.TeamOpening.create({ _id: ids.opening, team_id: ids.team, title: "Backend collaborator", description: "Help build transparent discovery workflows.", role: "backend_developer", required_skill_ids: [skillBySlug.get("node-js")], preferred_skill_ids: [skillBySlug.get("mongodb")], commitment: "few_hours", status: "open", created_by: ids.owner, revision: 0 });
  await models.Project.create({ _id: ids.project, team_id: ids.team, name: "Discovery Proof", slug: projectSlug, tagline: "Evidence-backed teammate discovery", description: "Internal fixture details", status: "completed", visibility: "public", created_by: ids.owner, completed_at: new Date() });
  await models.ProjectParticipant.create({ _id: randomUUID(), team_id: ids.team, project_id: ids.project, user_id: ids.react, role: "contributor", status: "active", show_on_profile: true });
  await models.ProjectTask.create({ _id: ids.task, team_id: ids.team, project_id: ids.project, title: "Private discovery implementation task", status: "done", priority: "high", created_by: ids.owner, assignee_ids: [ids.react], completed_at: new Date(), revision: 1 });
  const evidenceIds = [randomUUID(), randomUUID()];
  await models.ContributionEvidence.insertMany([
    { _id: evidenceIds[0], team_id: ids.team, project_id: ids.project, user_id: ids.react, title: "Completed Project work", evidence_type: "project_task_completion", verification_level: "internal_verified", status: "active", origin: "system", source_key: `task:${ids.task}:${ids.react}`, task_id: ids.task, public_safe: false, created_by: ids.react, occurred_at: new Date(), verified_at: new Date() },
    { _id: evidenceIds[1], team_id: ids.team, project_id: ids.project, user_id: ids.react, title: "Verified public pull request", evidence_type: "github_pull_request", verification_level: "external_verified", status: "active", origin: "user", source_key: "github_pull_request:octocat/hello-world:11096", provider: "github", provider_ref: "11096", source_url: "https://github.com/octocat/Hello-World/pull/11096", public_safe: true, created_by: ids.react, occurred_at: new Date(), verified_at: new Date() },
  ]);
  await models.ProjectShowcase.create({ _id: ids.showcase, team_id: ids.team, project_id: ids.project, status: "published", headline: "Discovery grounded in inspectable work", summary: "A public Project preview proving that factual contribution context can support teammate discovery without scores.", problem: "Opaque matching hides why people appear.", solution: "Structured filters and public evidence make every result explainable.", outcome: "Teams can find collaborators while preserving profile intent and privacy.", featured_evidence_ids: evidenceIds, featured_skills: ["React", "Node.js", "MongoDB"], created_by: ids.owner, updated_by: ids.owner, published_at: new Date(), revision: 1 });
  process.stdout.write(JSON.stringify({
    urls: { people: "http://127.0.0.1:5173/people", collaboration: "http://127.0.0.1:5173/collaboration", teamSettings: `http://127.0.0.1:5173/teams/${teamSlug}/settings#openings` },
    credentials: Object.fromEntries(labels.map((label) => [label, { email: emails[label], password }])),
    ids: { team: ids.team, opening: ids.opening, users: Object.fromEntries(labels.map((label) => [label, ids[label]])) },
  }, null, 2));
};

const run = async () => {
  await connectDatabase();
  try {
    if (process.argv[2] === "cleanup") { await cleanup(); process.stdout.write("Phase 6 browser fixture cleaned.\n"); }
    else await setup();
  } finally { await disconnectDatabase(); }
};
run().catch((error) => { process.stderr.write(`Phase 6 browser fixture failed: ${error.stack || error.message}\n`); process.exitCode = 1; }).finally(disconnectDatabase);
