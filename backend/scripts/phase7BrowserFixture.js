require("../src/config/loadEnv");
require("./lib/stagingSafety").assertStagingMutationAllowed();
const { randomBytes, randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const eventSlug = "phase7-browser-hackathon"; const teamSlug = "phase7-browser-team"; const projectSlug = "climate-console";
const password = `Tn-QA-${randomBytes(18).toString("base64url")}9aA!`; const labels = ["owner", "admin", "member", "teammate", "private"];
const emails = Object.fromEntries(labels.map((label) => [label, `phase7-${label}@example.invalid`]));
const trustedIn = (values) => mongoose.trusted({ $in: values });

const cleanup = async () => {
  const users = await models.User.find({ email: trustedIn(Object.values(emails)) }).select("_id").lean(); const userIds = users.map((row) => String(row._id));
  const events = await models.Hackathon.find({ slug: eventSlug }).select("_id").lean(); const eventIds = events.map((row) => String(row._id));
  const teams = await models.Team.find({ slug: teamSlug }).select("_id").lean(); const teamIds = teams.map((row) => String(row._id));
  const projects = await models.Project.find({ team_id: trustedIn(teamIds) }).select("_id").lean(); const projectIds = projects.map((row) => String(row._id));
  const registrations = await models.HackathonTeam.find({ hackathon_id: trustedIn(eventIds) }).select("_id").lean(); const registrationIds = registrations.map((row) => String(row._id));
  await Promise.all([
    models.Notification.deleteMany({ $or: mongoose.trusted([{ recipient_id: trustedIn(userIds) }, { actor_id: trustedIn(userIds) }]) }),
    models.HackathonActivity.deleteMany({ hackathon_id: trustedIn(eventIds) }), models.HackathonSubmission.deleteMany({ hackathon_id: trustedIn(eventIds) }),
    models.TeamOpening.deleteMany({ $or: mongoose.trusted([{ team_id: trustedIn(teamIds) }, { hackathon_id: trustedIn(eventIds) }]) }),
    models.CollaborationRequest.deleteMany({ $or: mongoose.trusted([{ sender_id: trustedIn(userIds) }, { recipient_id: trustedIn(userIds) }, { hackathon_id: trustedIn(eventIds) }]) }),
    models.ProjectShowcase.deleteMany({ project_id: trustedIn(projectIds) }), models.ProjectRepository.deleteMany({ project_id: trustedIn(projectIds) }),
    models.ContributionEvidence.deleteMany({ project_id: trustedIn(projectIds) }), models.ProjectActivity.deleteMany({ project_id: trustedIn(projectIds) }),
    models.ProjectTask.deleteMany({ project_id: trustedIn(projectIds) }), models.ProjectMilestone.deleteMany({ project_id: trustedIn(projectIds) }), models.ProjectParticipant.deleteMany({ project_id: trustedIn(projectIds) }),
    models.TeamActivity.deleteMany({ team_id: trustedIn(teamIds) }), models.TeamInvitation.deleteMany({ team_id: trustedIn(teamIds) }), models.TeamJoinRequest.deleteMany({ team_id: trustedIn(teamIds) }), models.TeamMembership.deleteMany({ team_id: trustedIn(teamIds) }),
    models.UserBlock.deleteMany({ $or: mongoose.trusted([{ blocker_id: trustedIn(userIds) }, { blocked_user_id: trustedIn(userIds) }]) }), models.UserSkill.deleteMany({ user_id: trustedIn(userIds) }), models.UserEducation.deleteMany({ user_id: trustedIn(userIds) }),
    models.HackathonTeam.deleteMany({ _id: trustedIn(registrationIds) }), models.HackathonParticipant.deleteMany({ hackathon_id: trustedIn(eventIds) }),
  ]);
  await models.Hackathon.deleteMany({ _id: trustedIn(eventIds) }); await models.Project.deleteMany({ _id: trustedIn(projectIds) }); await models.Team.deleteMany({ _id: trustedIn(teamIds) });
  await models.UserProfile.deleteMany({ _id: trustedIn(userIds) }); await models.User.deleteMany({ _id: trustedIn(userIds) }); await models.AuditLog.deleteMany({ user_id: trustedIn(userIds) });
};

const setup = async () => {
  await cleanup(); const ids = Object.fromEntries([...labels, "event", "team", "project"].map((label) => [label, randomUUID()]));
  const hash = await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS) || 12); const names = { owner: ["Nora", "Owner"], admin: ["Arun", "Admin"], member: ["Maya", "Member"], teammate: ["Tara", "Teammate"], private: ["Pavel", "Private"] };
  await models.User.insertMany(labels.map((label) => ({ _id: ids[label], email: emails[label], password: hash, role: label === "owner" ? "client" : "freelancer", profile: { firstName: names[label][0], lastName: names[label][1] }, status: "active" })));
  await models.UserProfile.insertMany(labels.map((label) => ({
    _id: ids[label], username: `phase7-${label}`, headline: label === "teammate" ? "ML engineer ready for a climate Hackathon" : `${names[label].join(" ")} Hackathon builder`,
    visibility: label === "private" ? "private" : "public", discoverable: label !== "private", availability: "open", collaboration_commitment: label === "teammate" ? "full_time" : "few_hours",
    preferred_roles: [label === "teammate" ? "ml_engineer" : "backend_developer"], interests: ["hackathons", "climate_tech"], onboarding_completed: true,
  })));
  const skills = await models.Skill.find({ slug: trustedIn(["react", "node-js", "mongodb", "python", "machine-learning"]) }).lean(); const skill = new Map(skills.map((row) => [row.slug, String(row._id)]));
  await models.UserSkill.insertMany([
    { _id: randomUUID(), user_id: ids.owner, skill_id: skill.get("node-js"), proficiency: "advanced", is_primary: true },
    { _id: randomUUID(), user_id: ids.teammate, skill_id: skill.get("python"), proficiency: "advanced", is_primary: true },
    { _id: randomUUID(), user_id: ids.teammate, skill_id: skill.get("machine-learning"), proficiency: "advanced", is_primary: true },
  ]);
  await models.Team.create({ _id: ids.team, name: "Climate Console Crew", slug: teamSlug, tagline: "A focused climate prototype Team", description: "Existing TaskNexus Team used by Hackathon Mode.", created_by: ids.owner, owner_id: ids.owner, visibility: "public", join_policy: "invite_only", primary_interests: ["climate_tech", "hackathons"], status: "active" });
  await models.TeamMembership.insertMany([
    { _id: randomUUID(), team_id: ids.team, user_id: ids.owner, role: "owner", status: "active" }, { _id: randomUUID(), team_id: ids.team, user_id: ids.admin, role: "admin", status: "active" }, { _id: randomUUID(), team_id: ids.team, user_id: ids.member, role: "member", status: "active" },
  ]);
  await models.Project.create({ _id: ids.project, team_id: ids.team, name: "Climate Console", slug: projectSlug, tagline: "Make local emissions legible", description: "A working dashboard that turns public climate data into useful local decisions.", status: "active", visibility: "team", created_by: ids.owner, repository_url: "https://github.com/octocat/Hello-World", demo_url: "https://example.com/climate-console" });
  await models.ProjectParticipant.insertMany([{ _id: randomUUID(), team_id: ids.team, project_id: ids.project, user_id: ids.owner, role: "lead", status: "active" }, { _id: randomUUID(), team_id: ids.team, project_id: ids.project, user_id: ids.admin, role: "contributor", status: "active" }]);
  const now = Date.now();
  await models.Hackathon.create({ _id: ids.event, name: "Build for Earth 2027", slug: eventSlug, tagline: "Ship one credible climate tool with a Team you trust.", description: "A participant-first Hackathon for developers building inspectable climate tools. Use existing TaskNexus Teams, Projects, tasks, and contribution evidence from start to finish.", organizer_name: "TaskNexus Labs", website_url: "https://example.com/build-for-earth", mode: "hybrid", city: "Bengaluru", venue: "Innovation Hall", registration_start: new Date(now - 86400000), registration_deadline: new Date(now + 7 * 86400000), event_start: new Date(now + 8 * 86400000), event_end: new Date(now + 10 * 86400000), submission_deadline: new Date(now + 10 * 86400000 - 3600000), team_min_size: 2, team_max_size: 5, status: "registration_open", visibility: "public", allowed_roles: ["frontend_developer", "backend_developer", "ml_engineer", "ui_ux_designer"], recommended_skill_ids: [skill.get("react"), skill.get("node-js"), skill.get("python")], themes: ["climate", "public data", "developer tools"], submission_requirements: [{ type: "project_title", label: "Project title", required: true }, { type: "project_description", label: "Project description", required: true }, { type: "repository", label: "Repository", required: true }, { type: "demo", label: "Working demo", required: true }, { type: "presentation", label: "Pitch deck", required: true }, { type: "team_confirmed", label: "Team members confirmed", required: true }, { type: "submission_url", label: "Final submission URL", required: true }], created_by: ids.owner });
  await models.HackathonParticipant.insertMany([
    { _id: randomUUID(), hackathon_id: ids.event, user_id: ids.teammate, status: "participating", looking_for_team: true, visible_on_hackathon: true, preferred_roles: ["ml_engineer"], preferred_skill_ids: [skill.get("python"), skill.get("machine-learning")], commitment: "full_time", message: "I can own the data and ML prototype." },
    { _id: randomUUID(), hackathon_id: ids.event, user_id: ids.private, status: "participating", looking_for_team: true, visible_on_hackathon: true, preferred_roles: ["backend_developer"], commitment: "few_hours" },
  ]);
  process.stdout.write(JSON.stringify({
    urls: { hub: "http://127.0.0.1:5174/hackathons", detail: `http://127.0.0.1:5174/hackathons/${eventSlug}` }, credentials: Object.fromEntries(labels.map((label) => [label, { email: emails[label], password }])), ids: { event: ids.event, team: ids.team, project: ids.project, users: Object.fromEntries(labels.map((label) => [label, ids[label]])) },
  }, null, 2));
};

const run = async () => { await connectDatabase(); try { if (process.argv[2] === "cleanup") { await cleanup(); process.stdout.write("Phase 7 browser fixture cleaned.\n"); } else await setup(); } finally { await disconnectDatabase(); } };
run().catch((error) => { process.stderr.write(`Phase 7 browser fixture failed: ${error.stack || error.message}\n`); process.exitCode = 1; }).finally(disconnectDatabase);
