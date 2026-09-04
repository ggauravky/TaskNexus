require("../src/config/loadEnv");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const mongoose = require("mongoose");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");
const teamService = require("../src/services/teamService");
const membershipService = require("../src/services/membershipService");
const invitationService = require("../src/services/invitationService");
const joinRequestService = require("../src/services/joinRequestService");

const runId = randomUUID();
const marker = runId.slice(0, 8);
const userIds = Object.fromEntries(["owner", "admin", "member", "requester", "invitee", "rival", "outsider"].map((role) => [role, randomUUID()]));
const teamIds = [];

const inList = (values) => mongoose.trusted({ $in: values });

const cleanup = async () => {
  const teamFilter = { team_id: inList(teamIds) };
  await Promise.all([
    models.Notification.deleteMany({ $or: mongoose.trusted([{ recipient_id: inList(Object.values(userIds)) }, { entity_id: inList(teamIds) }]) }),
    models.TeamActivity.deleteMany(teamFilter),
    models.TeamInvitation.deleteMany(teamFilter),
    models.TeamJoinRequest.deleteMany(teamFilter),
    models.TeamMembership.deleteMany(teamFilter),
  ]);
  await models.Team.deleteMany({ _id: inList(teamIds) });
  await Promise.all([
    models.UserSkill.deleteMany({ user_id: inList(Object.values(userIds)) }),
    models.UserProfile.deleteMany({ _id: inList(Object.values(userIds)) }),
    models.User.deleteMany({ _id: inList(Object.values(userIds)) }),
  ]);
};

const createUsers = async () => {
  await models.User.insertMany(Object.entries(userIds).map(([role, id]) => ({
    _id: id, email: `phase3-${marker}-${role}@example.invalid`, password: "integration-hash", role: role === "owner" ? "client" : "freelancer",
    profile: { firstName: `Phase3 ${role}`, lastName: marker }, status: "active",
  })));
  await models.UserProfile.insertMany(Object.entries(userIds).map(([role, id]) => ({
    _id: id, username: `p3-${role}-${marker}`.slice(0, 30), headline: `${role} integration profile`, visibility: "public",
  })));
};

const expectOneWinner = (settled, label) => {
  assert.equal(settled.filter((item) => item.status === "fulfilled").length, 1, `${label} must have one winner`);
  assert.equal(settled.filter((item) => item.status === "rejected").length, 1, `${label} must reject one racer`);
};

const run = async () => {
  await connectDatabase();
  try {
    await cleanup();
    await createUsers();

    const rollbackSlug = `phase3-rollback-${marker}`;
    const originalMembershipCreate = models.TeamMembership.create;
    models.TeamMembership.create = async () => { throw new Error("forced owner membership failure"); };
    try {
      await assert.rejects(teamService.createTeam(userIds.owner, { name: "Rollback team", slug: rollbackSlug }));
    } finally {
      models.TeamMembership.create = originalMembershipCreate;
    }
    assert.equal(await models.Team.countDocuments({ slug: rollbackSlug }), 0, "failed creation must roll back team");
    assert.equal(await models.TeamActivity.countDocuments({ team_id: inList(teamIds) }), 0);

    const created = await teamService.createTeam(userIds.owner, {
      name: `Phase 3 Team ${marker}`, slug: `phase3-team-${marker}`, tagline: "Atlas integration team",
      visibility: "public", joinPolicy: "open", primaryInterests: ["developer_tools", "open_source"],
    });
    teamIds.push(created.id);
    assert.equal(created.viewer_relationship.role, "owner");
    assert.equal(await models.TeamMembership.countDocuments({ team_id: created.id, role: "owner", status: "active" }), 1);
    assert.equal(await models.TeamActivity.countDocuments({ team_id: created.id, type: "team_created" }), 1);
    await assert.rejects(teamService.createTeam(userIds.owner, { name: "Duplicate", slug: created.slug }), (error) => error.code === "TEAM_SLUG_TAKEN");

    await membershipService.joinOpenTeam(created.id, userIds.admin);
    await membershipService.changeRole(created.id, userIds.admin, userIds.owner, "admin");
    await membershipService.joinOpenTeam(created.id, userIds.member);

    const joinRace = await Promise.allSettled([
      membershipService.joinOpenTeam(created.id, userIds.rival),
      membershipService.joinOpenTeam(created.id, userIds.rival),
    ]);
    expectOneWinner(joinRace, "duplicate open join race");
    assert.equal(await models.TeamMembership.countDocuments({ team_id: created.id, user_id: userIds.rival, status: "active" }), 1);

    await teamService.updateTeam(created.id, userIds.owner, { joinPolicy: "request" });
    const joinRequest = await joinRequestService.createRequest(created.id, userIds.requester, { message: "I can contribute to the API." });
    await assert.rejects(joinRequestService.createRequest(created.id, userIds.requester, {}), (error) => error.code === "JOIN_REQUEST_EXISTS");
    const requestRace = await Promise.allSettled([
      joinRequestService.reviewRequest(joinRequest.id, userIds.owner, "accepted"),
      joinRequestService.reviewRequest(joinRequest.id, userIds.admin, "accepted"),
    ]);
    expectOneWinner(requestRace, "join request approval race");
    assert.equal(await models.TeamMembership.countDocuments({ team_id: created.id, user_id: userIds.requester, status: "active" }), 1);
    assert.equal(await models.Notification.countDocuments({ entity_id: created.id, recipient_id: userIds.requester, type: "team_join_request_accepted" }), 1);

    await teamService.updateTeam(created.id, userIds.owner, { joinPolicy: "invite_only" });
    const invitation = await invitationService.sendInvitation(created.id, userIds.admin, { userId: userIds.invitee, message: "Join our integration team." });
    await assert.rejects(invitationService.sendInvitation(created.id, userIds.owner, { userId: userIds.invitee }), (error) => error.code === "TEAM_INVITATION_EXISTS");
    const invitationRace = await Promise.allSettled([
      invitationService.respond(invitation.id, userIds.invitee, "accepted"),
      invitationService.respond(invitation.id, userIds.invitee, "accepted"),
    ]);
    expectOneWinner(invitationRace, "invitation acceptance race");
    assert.equal(await models.TeamMembership.countDocuments({ team_id: created.id, user_id: userIds.invitee, status: "active" }), 1);
    assert.equal(await models.Notification.countDocuments({ entity_id: created.id, type: "team_invitation_accepted" }), 1);

    await membershipService.changeRole(created.id, userIds.member, userIds.owner, "admin");
    await membershipService.changeRole(created.id, userIds.member, userIds.owner, "member");
    await assert.rejects(membershipService.changeRole(created.id, userIds.member, userIds.admin, "admin"), (error) => error.code === "TEAM_ACCESS_DENIED");

    await teamService.updateTeam(created.id, userIds.admin, { visibility: "private" });
    await assert.rejects(teamService.getTeamBySlug(created.slug, userIds.outsider), (error) => error.code === "TEAM_NOT_FOUND");
    assert.equal((await teamService.getTeamBySlug(created.slug, userIds.member)).id, created.id);

    await membershipService.removeMember(created.id, userIds.member, userIds.admin);
    assert.equal((await models.TeamMembership.findOne({ team_id: created.id, user_id: userIds.member }).lean()).status, "removed");
    await membershipService.leaveTeam(created.id, userIds.rival);
    assert.equal((await models.TeamMembership.findOne({ team_id: created.id, user_id: userIds.rival }).lean()).status, "left");
    await assert.rejects(membershipService.leaveTeam(created.id, userIds.owner), (error) => error.code === "OWNER_TRANSFER_REQUIRED");

    const transferRace = await Promise.allSettled([
      membershipService.transferOwnership(created.id, userIds.requester, userIds.owner),
      membershipService.transferOwnership(created.id, userIds.invitee, userIds.owner),
    ]);
    expectOneWinner(transferRace, "ownership transfer race");
    const teamAfterTransfer = await models.Team.findById(created.id).lean();
    const activeOwners = await models.TeamMembership.find({ team_id: created.id, role: "owner", status: "active" }).lean();
    assert.equal(activeOwners.length, 1);
    assert.equal(activeOwners[0].user_id, teamAfterTransfer.owner_id);

    const indexes = await Promise.all([
      models.Team.collection.indexes(), models.TeamMembership.collection.indexes(), models.TeamInvitation.collection.indexes(),
      models.TeamJoinRequest.collection.indexes(), models.TeamActivity.collection.indexes(),
    ]);
    for (const list of indexes) assert.ok(list.length > 1, "Phase 3 collection indexes must exist");
    const plan = await models.Team.find({ visibility: "public", status: "active" }).sort({ created_at: -1 }).explain("queryPlanner");
    assert.match(JSON.stringify(plan.queryPlanner?.winningPlan || {}), /IXSCAN/);

    await teamService.archiveTeam(created.id, teamAfterTransfer.owner_id);
    assert.equal((await models.Team.findById(created.id).lean()).status, "archived");
    process.stdout.write("Teams integration verification passed: rollback, RBAC, privacy, membership, invitations, requests, notifications, indexes, races, ownership, and archival.\n");
  } finally {
    await cleanup();
  }
};

run().catch((error) => {
  process.stderr.write(`Teams integration verification failed: ${error.stack || error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
