require("../src/config/loadEnv");
require("./lib/stagingSafety").assertStagingMutationAllowed();
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");
const projectService = require("../src/services/projectService");
const participantService = require("../src/services/projectParticipantService");
const taskService = require("../src/services/projectTaskService");
const contributionService = require("../src/services/contributionService");
const repositoryService = require("../src/services/projectRepositoryService");
const showcaseService = require("../src/services/showcaseService");

const runId = randomUUID();
const ids = { owner: randomUUID(), contributor: randomUUID(), outsider: randomUUID() };
const teamId = randomUUID();
let projectId = null;

const fulfilled = (results) => results.filter((item) => item.status === "fulfilled");
const rejected = (results) => results.filter((item) => item.status === "rejected");

const createFixtures = async () => {
  for (const [name, id] of Object.entries(ids)) {
    await models.User.create({ _id: id, email: `phase5-${runId}-${name}@example.invalid`, password: "integration-only", role: "freelancer", profile: { firstName: name, lastName: "Evidence" }, status: "active" });
    await models.UserProfile.create({ _id: id, username: `p5-${runId.slice(0, 8)}-${name}`.slice(0, 30), headline: `${name} evidence verifier`, visibility: "public", github_url: name === "contributor" ? "https://github.com/octocat" : null, onboarding_completed: true });
  }
  await models.Team.create({ _id: teamId, name: "Phase Five Verification", slug: `phase-five-${runId.slice(0, 8)}`, created_by: ids.owner, owner_id: ids.owner, visibility: "public", join_policy: "invite_only", status: "active" });
  await models.TeamMembership.insertMany([
    { _id: randomUUID(), team_id: teamId, user_id: ids.owner, role: "owner", status: "active" },
    { _id: randomUUID(), team_id: teamId, user_id: ids.contributor, role: "member", status: "active" },
  ]);
};

const cleanup = async () => {
  const projectFilter = { team_id: teamId };
  await Promise.all([
    models.Notification.deleteMany({ $or: mongoose.trusted([{ recipient_id: mongoose.trusted({ $in: Object.values(ids) }) }, { entity_id: projectId }]) }),
    models.ProjectShowcase.deleteMany(projectFilter), models.ProjectRepository.deleteMany(projectFilter),
    models.ContributionEvidence.deleteMany(projectFilter), models.ProjectActivity.deleteMany(projectFilter),
    models.ProjectTask.deleteMany(projectFilter), models.ProjectMilestone.deleteMany(projectFilter), models.ProjectParticipant.deleteMany(projectFilter),
  ]);
  await models.Project.deleteMany(projectFilter);
  await models.TeamActivity.deleteMany({ team_id: teamId });
  await models.TeamMembership.deleteMany({ team_id: teamId });
  await models.Team.deleteOne({ _id: teamId });
  await models.UserProfile.deleteMany({ _id: mongoose.trusted({ $in: Object.values(ids) }) });
  await models.User.deleteMany({ _id: mongoose.trusted({ $in: Object.values(ids) }) });
};

const fakeProvider = {
  verifyRepository: async ({ owner, repository }) => ({ owner, repository, canonicalUrl: `https://github.com/${owner}/${repository}`, description: "Public fixture", defaultBranch: "main", isPrivate: false, archived: false }),
  verifyCommit: async ({ ref }) => ({ sha: ref, url: `https://github.com/octocat/Hello-World/commit/${ref}`, authorLogin: "octocat", title: "Verified fixture commit", occurredAt: "2026-01-02T00:00:00Z", verification: "valid" }),
  verifyPullRequest: async ({ ref }) => ({ number: ref, url: `https://github.com/octocat/Hello-World/pull/${ref}`, authorLogin: "octocat", title: "Verified fixture pull request", state: "open", merged: false, occurredAt: "2026-01-03T00:00:00Z" }),
};

const run = async () => {
  await connectDatabase();
  try {
    await createFixtures();
    const project = await projectService.createProject(teamId, ids.owner, { name: "Evidence Architecture", slug: `evidence-${runId.slice(0, 8)}`, visibility: "public" });
    projectId = project.id;
    await participantService.addParticipant(projectId, ids.owner, { userId: ids.contributor, role: "contributor" });
    await projectService.transitionProject(projectId, ids.owner, "active");

    let task = await taskService.createTask(projectId, ids.owner, { title: "Private implementation detail", description: "Must never enter a public DTO" });
    task = await taskService.setAssignees(task.id, ids.owner, { revision: task.revision, assigneeIds: [ids.owner, ids.contributor] });
    task = await taskService.changeStatus(task.id, ids.contributor, { revision: task.revision, status: "in_progress" });
    const completionRace = await Promise.allSettled([
      taskService.changeStatus(task.id, ids.contributor, { revision: task.revision, status: "done" }),
      taskService.changeStatus(task.id, ids.owner, { revision: task.revision, status: "done" }),
    ]);
    assert.equal(fulfilled(completionRace).length, 1);
    assert.equal(rejected(completionRace).length, 1);
    let evidence = await models.ContributionEvidence.find({ task_id: task.id, status: "active" }).lean();
    assert.equal(evidence.length, 2);
    assert.deepEqual(new Set(evidence.map((row) => row.title)), new Set(["Contributed to completed task"]));

    task = fulfilled(completionRace)[0].value;
    const reopenRace = await Promise.allSettled([
      taskService.changeStatus(task.id, ids.owner, { revision: task.revision, status: "in_progress" }),
      taskService.changeStatus(task.id, ids.owner, { revision: task.revision, status: "in_progress" }),
    ]);
    assert.equal(fulfilled(reopenRace).length, 1);
    assert.equal(await models.ContributionEvidence.countDocuments({ task_id: task.id, status: "active" }), 0);
    assert.equal(await models.ContributionEvidence.countDocuments({ task_id: task.id, status: "revoked" }), 2);
    task = fulfilled(reopenRace)[0].value;
    task = await taskService.changeStatus(task.id, ids.contributor, { revision: task.revision, status: "done" });
    assert.equal(await models.ContributionEvidence.countDocuments({ task_id: task.id, status: "active" }), 2);

    let repository = await repositoryService.addRepository(projectId, ids.owner, { url: "https://github.com/octocat/Hello-World.git/" });
    repository = await repositoryService.verifyRepository(projectId, repository.id, ids.owner, fakeProvider);
    assert.equal(repository.verification_status, "verified");

    const commitInput = { type: "github_commit", title: "Commit claim", sourceUrl: "https://github.com/octocat/Hello-World/commit/6dcb09b5b57875f334f61aebed695e2e4193db5e" };
    const commitRace = await Promise.allSettled([
      contributionService.addEvidence(projectId, ids.contributor, commitInput),
      contributionService.addEvidence(projectId, ids.contributor, commitInput),
    ]);
    assert.equal(fulfilled(commitRace).length, 1); assert.equal(rejected(commitRace).length, 1);
    const verifiedCommit = await contributionService.verifyEvidence(fulfilled(commitRace)[0].value.id, ids.contributor, fakeProvider);
    assert.equal(verifiedCommit.verification, "external_verified");

    const prInput = { type: "github_pull_request", title: "Pull request claim", sourceUrl: "https://github.com/octocat/Hello-World/pull/1347" };
    const prRace = await Promise.allSettled([
      contributionService.addEvidence(projectId, ids.contributor, prInput),
      contributionService.addEvidence(projectId, ids.contributor, prInput),
    ]);
    assert.equal(fulfilled(prRace).length, 1); assert.equal(rejected(prRace).length, 1);
    const verifiedPr = await contributionService.verifyEvidence(fulfilled(prRace)[0].value.id, ids.contributor, fakeProvider);
    assert.equal(verifiedPr.metadata.merged, false);

    await contributionService.setProfileVisibility(projectId, ids.contributor, true);
    await projectService.transitionProject(projectId, ids.owner, "completed");
    const completed = await models.Project.findById(projectId).lean();
    assert.ok(completed.completion_evidence_ids.length >= 4);
    const activeEvidence = await models.ContributionEvidence.find({ project_id: projectId, status: "active" }).sort({ occurred_at: -1 }).lean();
    let showcase = await showcaseService.updateShowcase(projectId, ids.owner, {
      headline: "Evidence without opaque scoring", summary: "A public case study grounded in inspectable contribution records.",
      problem: "Contribution summaries often erase provenance.", solution: "TaskNexus keeps facts, claims, timestamps, and verification separate.",
      outcome: "Attribution remains neutral and auditable.", featuredSkills: ["MongoDB", "React"],
      featuredEvidenceIds: activeEvidence.slice(0, 4).map((row) => String(row._id)), revision: 0,
    });
    const publishRace = await Promise.allSettled([
      showcaseService.publishShowcase(projectId, ids.owner, showcase.revision),
      showcaseService.publishShowcase(projectId, ids.owner, showcase.revision),
    ]);
    assert.equal(fulfilled(publishRace).length, 1); assert.equal(rejected(publishRace).length, 1);
    showcase = fulfilled(publishRace)[0].value;

    const publicDto = await showcaseService.getPublicShowcase(`phase-five-${runId.slice(0, 8)}`, `evidence-${runId.slice(0, 8)}`);
    const serialized = JSON.stringify(publicDto);
    assert.equal(serialized.includes("Private implementation detail"), false);
    assert.equal(serialized.includes("Must never enter"), false);
    assert.equal(publicDto.participants.every((item, index, rows) => index === 0 || rows[index - 1].profile.display_name.localeCompare(item.profile.display_name) <= 0), true);
    const profileProjects = await showcaseService.listPublicProfileProjects(ids.contributor);
    assert.equal(profileProjects.length, 1);

    const plans = await Promise.all([
      models.ContributionEvidence.find({ user_id: ids.contributor, status: "active" }).sort({ occurred_at: -1 }).explain("queryPlanner"),
      models.ContributionEvidence.find({ project_id: projectId, status: "active" }).sort({ occurred_at: -1 }).explain("queryPlanner"),
      models.ProjectShowcase.find({ team_id: teamId, status: "published" }).sort({ published_at: -1 }).explain("queryPlanner"),
      models.ProjectParticipant.find({ user_id: ids.contributor, show_on_profile: true }).explain("queryPlanner"),
    ]);
    plans.forEach((plan) => assert.match(JSON.stringify(plan.queryPlanner?.winningPlan || {}), /IXSCAN/));
    assert.equal(showcase.status, "published");
    process.stdout.write("Phase 5 Atlas verification passed: transactional evidence/reopen, multi-assignee attribution, commit/PR dedupe, provider verification, completion snapshot, publication race, public privacy, profile opt-in, and indexed feeds.\n");
  } finally { await cleanup(); }
};

run().catch((error) => { process.stderr.write(`Phase 5 Atlas verification failed: ${error.stack || error.message}\n`); process.exitCode = 1; }).finally(disconnectDatabase);
