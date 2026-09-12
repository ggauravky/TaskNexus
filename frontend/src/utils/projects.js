export const PROJECT_STATUS_LABELS = {
  planning: "Planning", active: "Active", completed: "Completed", archived: "Archived",
};

export const TASK_STATUS_LABELS = {
  todo: "To do", in_progress: "In progress", blocked: "Blocked", done: "Done",
};

export const MILESTONE_STATUS_LABELS = {
  planned: "Planned", in_progress: "In progress", completed: "Completed",
};

export const formatDate = (value) => value
  ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))
  : "No date";

export const progressPercent = (summary = {}) => summary.total
  ? Math.round(((summary.done || summary.completed || 0) / summary.total) * 100) : 0;

export const projectPath = (project) => `/teams/${project.team.slug}/projects/${project.slug}`;
