const domain = require("../../shared/contracts/domain.json");
const contracts = require("../src/contracts/domain");
const {
  Project, ProjectActivity, ProjectMilestone, ProjectParticipant, ProjectTask,
} = require("../src/models");
const authz = require("../src/services/projectAuthorization");
const { projectDetail, task: taskDto } = require("../src/serializers/projectSerializers");
const { dateValue, httpsUrl, idList, stringList, text } = require("../src/services/projectValidation");

const IDS = {
  team: "20000000-0000-4000-8000-000000000001",
  project: "20000000-0000-4000-8000-000000000002",
  user: "20000000-0000-4000-8000-000000000003",
  other: "20000000-0000-4000-8000-000000000004",
  milestone: "20000000-0000-4000-8000-000000000005",
};

const hasIndex = (Model, keys, options = {}) => Model.schema.indexes().some(([actualKeys, actualOptions]) => (
  JSON.stringify(actualKeys) === JSON.stringify(keys)
  && Object.entries(options).every(([key, value]) => actualOptions[key] === value)
));

const context = ({ teamRole, projectRole, projectVisibility = "team", teamVisibility = "public" } = {}) => ({
  project: { id: IDS.project, team_id: IDS.team, status: "active", visibility: projectVisibility },
  team: { id: IDS.team, status: "active", visibility: teamVisibility },
  membership: teamRole ? { role: teamRole, status: "active" } : null,
  participant: projectRole ? { role: projectRole, status: "active" } : null,
});

describe("Phase 4 canonical project contracts", () => {
  test("backend project enums are generated from the shared contract", () => {
    expect(Object.values(contracts.PROJECT_STATUS)).toEqual(domain.projectStatuses);
    expect(Object.values(contracts.PROJECT_VISIBILITY)).toEqual(domain.projectVisibilities);
    expect(Object.values(contracts.PROJECT_PARTICIPANT_ROLE)).toEqual(domain.projectParticipantRoles);
    expect(Object.values(contracts.PROJECT_TASK_STATUS)).toEqual(domain.projectTaskStatuses);
    expect(Object.values(contracts.PROJECT_MILESTONE_STATUS)).toEqual(domain.projectMilestoneStatuses);
  });

  test("project notification and activity types remain canonical", () => {
    expect(Object.values(contracts.PROJECT_NOTIFICATION_TYPES)).toEqual(expect.arrayContaining([
      "project_added", "project_task_assigned", "project_milestone_completed",
    ]));
    expect(Object.values(contracts.PROJECT_ACTIVITY_TYPES)).toContain("task_completed");
  });

  test("project, task, and milestone transitions are explicit", () => {
    expect(contracts.PROJECT_STATE_TRANSITIONS.planning).toEqual(["active", "archived"]);
    expect(contracts.PROJECT_TASK_TRANSITIONS.done).toEqual(["in_progress"]);
    expect(contracts.PROJECT_MILESTONE_TRANSITIONS.completed).toEqual(["in_progress"]);
  });
});

describe("Phase 4 MongoDB model validation", () => {
  test("accepts UUID/string IDs and normalizes a project slug", async () => {
    const project = new Project({
      _id: IDS.project, team_id: IDS.team, name: "Collaboration Engine", slug: "Collaboration-Engine", created_by: IDS.user,
    });
    await expect(project.validate()).resolves.toBeUndefined();
    expect(project.slug).toBe("collaboration-engine");
    expect(project._id).toBe(IDS.project);
  });

  test("rejects reserved slugs, unsafe URLs, and invalid lifecycle values", async () => {
    await expect(new Project({
      team_id: IDS.team, name: "Bad project", slug: "tasks", created_by: IDS.user,
      status: "shipping", visibility: "world", repository_url: "javascript:alert(1)",
    }).validate()).rejects.toThrow();
  });

  test("bounds canonical skills and task assignees", async () => {
    await expect(new Project({
      team_id: IDS.team, name: "Too many skills", slug: "too-many-skills", created_by: IDS.user,
      skill_ids: Array(13).fill(IDS.other),
    }).validate()).rejects.toThrow();
    await expect(new ProjectTask({
      team_id: IDS.team, project_id: IDS.project, title: "A task", created_by: IDS.user,
      assignee_ids: Array(13).fill(IDS.other),
    }).validate()).rejects.toThrow();
  });

  test("validates participant, task, milestone, and activity enums", async () => {
    await expect(new ProjectParticipant({ team_id: IDS.team, project_id: IDS.project, user_id: IDS.user, role: "owner" }).validate()).rejects.toThrow();
    await expect(new ProjectTask({ team_id: IDS.team, project_id: IDS.project, title: "Task", created_by: IDS.user, status: "assigned" }).validate()).rejects.toThrow();
    await expect(new ProjectMilestone({ team_id: IDS.team, project_id: IDS.project, name: "Milestone", created_by: IDS.user, status: "done" }).validate()).rejects.toThrow();
    await expect(new ProjectActivity({ team_id: IDS.team, project_id: IDS.project, actor_id: IDS.user, type: "request_viewed" }).validate()).rejects.toThrow();
  });

  test("task completion evidence has explicit revision and completion fields", async () => {
    const task = new ProjectTask({
      team_id: IDS.team, project_id: IDS.project, title: "Ship API", created_by: IDS.user,
      status: "done", completed_at: new Date(), revision: 4,
    });
    await expect(task.validate()).resolves.toBeUndefined();
    expect(task.revision).toBe(4);
  });
});

describe("Phase 4 database index contracts", () => {
  test("declares project and participant uniqueness", () => {
    expect(hasIndex(Project, { team_id: 1, slug: 1 }, { unique: true })).toBe(true);
    expect(hasIndex(ProjectParticipant, { project_id: 1, user_id: 1 }, { unique: true })).toBe(true);
  });

  test("declares listing, assignment, milestone, and activity indexes", () => {
    expect(hasIndex(Project, { team_id: 1, status: 1, updated_at: -1 })).toBe(true);
    expect(hasIndex(ProjectTask, { project_id: 1, status: 1, updated_at: -1 })).toBe(true);
    expect(hasIndex(ProjectTask, { assignee_ids: 1, status: 1 })).toBe(true);
    expect(hasIndex(ProjectMilestone, { project_id: 1, target_date: 1 })).toBe(true);
    expect(hasIndex(ProjectActivity, { project_id: 1, created_at: -1 })).toBe(true);
  });
});

describe("contextual project authorization matrix", () => {
  test("team owner and admin manage every project without project role escalation", () => {
    expect(authz.permissions(context({ teamRole: "owner" }))).toEqual(expect.objectContaining({
      edit_project: true, archive_project: true, manage_participants: true, manage_tasks: true,
    }));
    expect(authz.permissions(context({ teamRole: "admin" }))).toEqual(expect.objectContaining({
      edit_project: true, archive_project: true, manage_milestones: true,
    }));
  });

  test("lead manages one project while contributor only works in it", () => {
    expect(authz.permissions(context({ teamRole: "member", projectRole: "lead" }))).toEqual(expect.objectContaining({
      edit_project: true, archive_project: false, manage_participants: true, manage_tasks: true,
    }));
    expect(authz.permissions(context({ teamRole: "member", projectRole: "contributor" }))).toEqual(expect.objectContaining({
      edit_project: false, create_task: true, manage_tasks: false, update_assigned_task: true,
    }));
  });

  test("project participation never overrides inactive Team membership", () => {
    expect(authz.permissions(context({ projectRole: "lead" }))).toEqual(expect.objectContaining({
      view_workspace: false, edit_project: false, manage_tasks: false,
    }));
  });

  test("effective public visibility requires both public Team and public Project", () => {
    expect(authz.isEffectivePublic(context({ projectVisibility: "public", teamVisibility: "public" }))).toBe(true);
    expect(authz.isEffectivePublic(context({ projectVisibility: "public", teamVisibility: "private" }))).toBe(false);
    expect(authz.isEffectivePublic(context({ projectVisibility: "team", teamVisibility: "public" }))).toBe(false);
  });

  test("global marketplace roles are irrelevant to project permissions", () => {
    const result = authz.permissions({ ...context(), user: { role: "admin" } });
    expect(result.edit_project).toBe(false);
    expect(result.view_workspace).toBe(false);
  });
});

describe("Project API boundary helpers", () => {
  test("validation helpers reject operator-shaped and unsafe values", () => {
    expect(() => text({ $ne: "" }, 100, "Name", { required: true })).toThrow();
    expect(() => idList([{ $gt: "" }], 12, "Assignees")).toThrow();
    expect(() => stringList(["<script>"], 8, "Tags")).toThrow();
    expect(() => dateValue("not-a-date", "Due date")).toThrow();
    expect(() => httpsUrl("data:text/html,bad", "Repository URL")).toThrow();
  });

  test("project and task DTOs do not expose Mongo internals", () => {
    const project = projectDetail({
      id: IDS.project, _id: "hidden", team_id: IDS.team, name: "Project", slug: "project",
      status: "active", visibility: "team", __v: 2,
    });
    const task = taskDto({
      id: IDS.other, _id: "hidden", project_id: IDS.project, team_id: IDS.team,
      title: "Task", status: "todo", priority: "medium", assignee_ids: [], created_by: IDS.user, __v: 1,
    });
    expect(project).not.toHaveProperty("_id");
    expect(project).not.toHaveProperty("team_id");
    expect(task).not.toHaveProperty("_id");
    expect(task).not.toHaveProperty("team_id");
  });
});
