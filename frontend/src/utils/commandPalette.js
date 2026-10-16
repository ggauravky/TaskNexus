export const SEARCH_GROUP_ORDER = Object.freeze([
  "teams",
  "projects",
  "people",
  "hackathons",
  "opportunities",
  "organizations",
  "tasks",
]);

const sharedActions = Object.freeze([
  { id: "teams", title: "Teams", target: "/teams" },
  { id: "projects", title: "Projects", target: "/projects" },
  { id: "people", title: "People", target: "/people" },
  { id: "hackathons", title: "Hackathons", target: "/hackathons" },
  { id: "opportunities", title: "Opportunities", target: "/opportunities" },
  { id: "notifications", title: "Notifications", target: "/notifications" },
  { id: "profile", title: "Profile", target: "/profile" },
]);

const roleActions = Object.freeze({
  client: Object.freeze([
    { id: "create-task", title: "Create task", target: "/client/dashboard?action=create-task" },
    { id: "my-tasks", title: "My tasks", target: "/client/dashboard?view=tasks" },
    { id: "review-deliveries", title: "Review deliveries", target: "/client/dashboard?view=deliveries" },
  ]),
  freelancer: Object.freeze([
    { id: "my-work", title: "My work", target: "/freelancer/dashboard?view=work" },
    { id: "find-work", title: "Find work", target: "/freelancer/dashboard?view=available" },
    { id: "applications", title: "Applications", target: "/applications" },
    { id: "update-profile", title: "Update profile", target: "/profile" },
  ]),
  admin: Object.freeze([
    { id: "admin-dashboard", title: "Admin dashboard", target: "/admin/dashboard" },
    { id: "admin-tasks", title: "Manage tasks", target: "/admin/tasks" },
    { id: "admin-users", title: "Manage users", target: "/admin/users" },
    { id: "admin-analytics", title: "Analytics", target: "/admin/analytics" },
  ]),
});

export const quickActionsFor = (role) => {
  if (!Object.prototype.hasOwnProperty.call(roleActions, role)) return [];
  const deduplicated = new Map();
  [...roleActions[role], ...sharedActions].forEach((action) => {
    if (!deduplicated.has(action.target)) deduplicated.set(action.target, { ...action });
  });
  return [...deduplicated.values()];
};

const slug = "[a-z0-9]+(?:-[a-z0-9]+)*";
const username = "[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?";
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const dynamicTargets = Object.freeze([
  new RegExp(`^/teams/${slug}$`, "i"),
  new RegExp(`^/teams/${slug}/projects/${slug}$`, "i"),
  new RegExp(`^/u/${username}$`, "i"),
  new RegExp(`^/hackathons/${slug}$`, "i"),
  new RegExp(`^/opportunities/${slug}$`, "i"),
  new RegExp(`^/organizations/${slug}$`, "i"),
  new RegExp(`^/tasks/${uuid}$`, "i"),
]);
const exactTargets = new Set([
  "/teams", "/projects", "/people", "/hackathons", "/opportunities", "/applications",
  "/notifications", "/profile", "/admin/dashboard", "/admin/tasks", "/admin/users", "/admin/analytics",
  "/client/dashboard?action=create-task", "/client/dashboard?view=tasks", "/client/dashboard?view=deliveries",
  "/freelancer/dashboard?view=work", "/freelancer/dashboard?view=available",
]);

export const safeCommandTarget = (value) => {
  if (
    typeof value !== "string"
    || value !== value.trim()
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || value.includes("%")
    || [...value].some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    })
  ) return null;
  if (exactTargets.has(value) || dynamicTargets.some((pattern) => pattern.test(value))) return value;
  return null;
};

export const flattenPaletteOptions = (actions = [], groups = {}) => {
  const options = [];
  actions.forEach((action) => {
    const target = safeCommandTarget(action.target);
    if (target) options.push({ ...action, target, kind: "action", group: "actions" });
  });
  SEARCH_GROUP_ORDER.forEach((group) => {
    const rows = Array.isArray(groups[group]) ? groups[group].slice(0, 5) : [];
    rows.forEach((row) => {
      const target = safeCommandTarget(row.target_path);
      if (target) options.push({ ...row, target, kind: "result", group });
    });
  });
  return options;
};

export const nextPaletteIndex = (current, key, count) => {
  if (count <= 0) return -1;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowDown") return current < 0 ? 0 : (current + 1) % count;
  if (key === "ArrowUp") return current < 0 ? count - 1 : (current - 1 + count) % count;
  return current;
};

export const parseDashboardCommand = (searchParams, role) => {
  const params = searchParams instanceof URLSearchParams ? searchParams : new URLSearchParams(searchParams);
  const view = params.get("view");
  const action = params.get("action");
  if (role === "client") {
    return {
      view: ["tasks", "deliveries"].includes(view) ? view : "overview",
      action: action === "create-task" ? action : null,
    };
  }
  if (role === "freelancer") {
    return {
      view: ["work", "available"].includes(view) ? view : "overview",
      action: null,
    };
  }
  return { view: "overview", action: null };
};
