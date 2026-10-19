const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const TASK_TARGET = new RegExp(`^/tasks/${UUID}\\?tab=(?:work|delivery)$`, "i");
const EXACT_TARGETS = new Set([
  "/profile",
  "/projects",
  "/client/dashboard?action=create-task",
  "/client/dashboard?view=tasks",
  "/client/dashboard?view=deliveries",
  "/freelancer/dashboard?view=available",
  "/freelancer/dashboard?view=work",
]);

export const safeOnboardingTarget = (value) => (
  typeof value === "string" && (EXACT_TARGETS.has(value) || TASK_TARGET.test(value)) ? value : null
);

const viewItem = (item) => {
  const targetPath = safeOnboardingTarget(item?.action?.target_path);
  return {
    id: String(item?.id || ""),
    label: String(item?.label || ""),
    description: String(item?.description || ""),
    complete: Boolean(item?.complete),
    optional: Boolean(item?.optional),
    action: targetPath && typeof item?.action?.label === "string" && item.action.label.trim()
      ? { label: item.action.label.trim(), targetPath }
      : null,
  };
};

export const onboardingView = (summary) => {
  if (!summary || !["client", "freelancer"].includes(summary.role) || summary.is_complete) return null;
  const applicable = (items) => (Array.isArray(items) ? items : [])
    .filter((item) => item?.applicable)
    .map(viewItem);
  return {
    role: summary.role,
    completedCount: Number.isFinite(summary.completed_count) ? summary.completed_count : 0,
    totalCount: Number.isFinite(summary.total_count) ? summary.total_count : 0,
    items: applicable(summary.items),
    optionalItems: applicable(summary.optional_items),
  };
};
