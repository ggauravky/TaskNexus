const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ASSIGNED_STATUSES = new Set([
  "assigned",
  "in_progress",
  "submitted_work",
  "qa_review",
  "revision_requested",
  "delivered",
  "client_revision",
  "completed",
  "disputed",
]);

const STARTED_STATUSES = new Set([
  "in_progress",
  "submitted_work",
  "qa_review",
  "revision_requested",
  "delivered",
  "client_revision",
  "completed",
  "disputed",
]);

const validTaskTarget = (task, tab, fallback) => (
  UUID_PATTERN.test(String(task?.id || "")) ? `/tasks/${task.id}?tab=${tab}` : fallback
);

const newest = (tasks) => [...tasks].sort((left, right) => {
  const rightTime = new Date(right?.updated_at || right?.updatedAt || 0).getTime();
  const leftTime = new Date(left?.updated_at || left?.updatedAt || 0).getTime();
  return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
})[0] || null;

const assigned = (task) => Boolean(
  task?.workflow?.assignedAt
  || task?.freelancer_id
  || task?.freelancerId
  || ASSIGNED_STATUSES.has(task?.status)
);

const started = (task) => Boolean(task?.workflow?.startedAt || STARTED_STATUSES.has(task?.status));
const completed = (task) => Boolean(task?.workflow?.completedAt || task?.status === "completed");

const summary = (role, items, optionalItems = []) => {
  const applicable = items.filter((item) => item.applicable);
  const completedCount = applicable.filter((item) => item.complete).length;
  const isComplete = applicable.length > 0 && completedCount === applicable.length;
  return {
    role,
    isComplete,
    completedCount,
    totalCount: applicable.length,
    items,
    optionalItems: isComplete ? [] : optionalItems,
  };
};

const deriveClientOnboarding = ({ profileFacts = {}, tasks = [] } = {}) => {
  const ownedTasks = Array.isArray(tasks) ? tasks : [];
  const assignedTasks = ownedTasks.filter(assigned);
  const startedTasks = ownedTasks.filter(started);
  const deliveryTasks = ownedTasks.filter((task) => task?.status === "delivered" || completed(task));
  const completedTasks = ownedTasks.filter(completed);
  const trackingTask = newest(assignedTasks);
  const deliveryTask = newest(ownedTasks.filter((task) => task?.status === "delivered")) || newest(completedTasks);

  return summary("client", [
    {
      id: "client_identity",
      label: "Complete your identity",
      description: "Add your name and username so collaborators know who owns the work.",
      applicable: true,
      complete: Boolean(profileFacts.name && profileFacts.username),
      action: { label: "Update profile", targetPath: "/profile" },
    },
    {
      id: "create_marketplace_task",
      label: "Create your first marketplace task",
      description: "Turn a real brief into work freelancers can accept.",
      applicable: true,
      complete: ownedTasks.length > 0,
      action: { label: "Create task", targetPath: "/client/dashboard?action=create-task" },
    },
    {
      id: "track_first_task",
      label: "Track your first assigned task",
      description: "Use the task workspace once a freelancer is assigned.",
      applicable: assignedTasks.length > 0,
      complete: startedTasks.length > 0,
      action: {
        label: "Open task workspace",
        targetPath: validTaskTarget(trackingTask, "work", "/client/dashboard?view=tasks"),
      },
    },
    {
      id: "review_first_delivery",
      label: "Review your first delivery",
      description: "Approve delivered work or request a revision in the task workspace.",
      applicable: deliveryTasks.length > 0,
      complete: completedTasks.length > 0,
      action: {
        label: "Review delivery",
        targetPath: validTaskTarget(deliveryTask, "delivery", "/client/dashboard?view=deliveries"),
      },
    },
  ]);
};

const deriveFreelancerOnboarding = ({
  profileFacts = {},
  availability,
  tasks = [],
  hasPublicProof = false,
} = {}) => {
  const assignedTasks = (Array.isArray(tasks) ? tasks : []).filter(assigned);
  const completedTasks = assignedTasks.filter(completed);
  const activeTask = newest(assignedTasks.filter((task) => !completed(task)));
  const fundamentalsComplete = Boolean(
    profileFacts.name
    && profileFacts.username
    && profileFacts.headline
    && profileFacts.bio
    && profileFacts.locationAndTimezone
  );
  const requiredItems = [
    {
      id: "profile_fundamentals",
      label: "Complete your professional profile",
      description: "Add the core details clients and collaborators need.",
      applicable: true,
      complete: fundamentalsComplete,
      action: { label: "Complete profile", targetPath: "/profile" },
    },
    {
      id: "canonical_skill",
      label: "Add a canonical skill",
      description: "Choose at least one skill from the shared catalog.",
      applicable: true,
      complete: Boolean(profileFacts.skills),
      action: { label: "Add skills", targetPath: "/profile" },
    },
    {
      id: "first_marketplace_assignment",
      label: "Start your first marketplace assignment",
      description: "Find and accept work that fits your experience.",
      applicable: true,
      complete: assignedTasks.length > 0,
      action: { label: "Find work", targetPath: "/freelancer/dashboard?view=available" },
    },
    {
      id: "complete_marketplace_work",
      label: "Complete your first marketplace task",
      description: "Move assigned work through delivery and client approval.",
      applicable: assignedTasks.length > 0,
      complete: completedTasks.length > 0,
      action: {
        label: activeTask ? "Open current work" : "View my work",
        targetPath: activeTask
          ? validTaskTarget(activeTask, "work", "/freelancer/dashboard?view=work")
          : "/freelancer/dashboard?view=work",
      },
    },
  ];

  const optionalItems = [
    {
      id: "review_professional_availability",
      label: "Review your availability preference",
      description: availability === "unavailable"
        ? "You are not currently advertising availability, and that is a valid choice."
        : "Keep your professional availability aligned with how you want to collaborate.",
      applicable: true,
      complete: ["open", "limited", "unavailable"].includes(availability),
      optional: true,
      action: { label: "Review preference", targetPath: "/profile" },
    },
  ];
  if (completedTasks.length > 0) {
    optionalItems.push({
      id: "publish_public_safe_proof",
      label: "Share public project proof",
      description: "Optional: publish only work you choose to make public.",
      applicable: true,
      complete: Boolean(hasPublicProof),
      optional: true,
      action: { label: "Build project proof", targetPath: "/projects" },
    });
  }

  return summary("freelancer", requiredItems, optionalItems);
};

module.exports = {
  deriveClientOnboarding,
  deriveFreelancerOnboarding,
};
