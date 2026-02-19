const BASE_PREFERENCES = {
  compactCards: false,
  showProgressBars: true,
  showAdvancedStats: true,
  showDeadlineRail: true,
  hideFinancials: false,
  focusMode: false,
  taskLayout: "list",
  taskDensity: "cozy",
  defaultTaskFilter: "all",
  defaultTaskSort: "newest",
  autoRefresh: false,
  autoRefreshSeconds: 120,
  notifications: {
    email: true,
    inApp: true,
    dueReminders: true,
    statusUpdates: true,
  },
  quickActions: {
    templates: true,
    export: true,
    pinning: true,
  },
  goals: {
    weeklyEarnings: 1500,
    weeklyCompletedTasks: 5,
  },
};

const ROLE_PREFERENCE_OVERRIDES = {
  client: {
    defaultTaskFilter: "all",
    goals: {
      weeklyCompletedTasks: 3,
    },
  },
  freelancer: {
    defaultTaskFilter: "active",
    goals: {
      weeklyEarnings: 2000,
      weeklyCompletedTasks: 5,
    },
  },
  admin: {
    showAdvancedStats: true,
  },
};

const BUILTIN_PRESETS = [
  {
    id: "balanced",
    name: "Balanced",
    description: "Default workspace with all major panels enabled.",
    preferences: {},
  },
  {
    id: "focus",
    name: "Focus Mode",
    description: "Minimal interface for deep work and fewer distractions.",
    preferences: {
      focusMode: true,
      showAdvancedStats: false,
      showDeadlineRail: false,
      quickActions: { templates: false, export: false, pinning: true },
    },
  },
  {
    id: "analytics",
    name: "Analytics Heavy",
    description: "Prioritizes insights, progress visibility, and dashboards.",
    preferences: {
      showAdvancedStats: true,
      showProgressBars: true,
      showDeadlineRail: true,
      taskLayout: "grid",
      autoRefresh: true,
      autoRefreshSeconds: 60,
    },
  },
  {
    id: "delivery-sprint",
    name: "Delivery Sprint",
    description: "Board-centric workflow for high-volume execution.",
    preferences: {
      compactCards: true,
      taskLayout: "board",
      showProgressBars: true,
      defaultTaskSort: "deadline_soon",
      autoRefresh: true,
      autoRefreshSeconds: 45,
      quickActions: { templates: false, export: true, pinning: true },
    },
  },
];

const DEFAULT_BOARD_COLUMNS = {
  client: [
    { id: "planning", title: "Planning", visible: true },
    { id: "execution", title: "Execution", visible: true },
    { id: "done", title: "Done", visible: true },
    { id: "other", title: "Other", visible: true },
  ],
  freelancer: [
    { id: "active", title: "Active", visible: true },
    { id: "review", title: "Review", visible: true },
    { id: "done", title: "Done", visible: true },
    { id: "other", title: "Other", visible: true },
  ],
  admin: [
    { id: "incoming", title: "Incoming", visible: true },
    { id: "active", title: "Active", visible: true },
    { id: "qa", title: "QA", visible: true },
    { id: "done", title: "Done", visible: true },
  ],
};

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const deepMerge = (base, incoming) => {
  if (!isObject(base) || !isObject(incoming)) {
    return incoming === undefined ? base : incoming;
  }

  const merged = { ...base };

  for (const [key, value] of Object.entries(incoming)) {
    if (isObject(base[key]) && isObject(value)) {
      merged[key] = deepMerge(base[key], value);
    } else {
      merged[key] = value;
    }
  }

  return merged;
};

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const getDefaultPreferences = (role = "client") => {
  const roleOverride = ROLE_PREFERENCE_OVERRIDES[role] || {};
  return deepMerge(deepClone(BASE_PREFERENCES), roleOverride);
};

const getDefaultBoardState = (role = "client", boardKey = "default") => {
  const columns = deepClone(
    DEFAULT_BOARD_COLUMNS[role] || DEFAULT_BOARD_COLUMNS.client,
  );

  return {
    boardKey,
    view: "board",
    filter: "all",
    sort: "newest",
    columnOrder: columns.map((column) => column.id),
    columns,
    taskOrder: {},
    updatedAt: new Date().toISOString(),
  };
};

const buildPresetCatalog = (role = "client", userPresets = []) => {
  const base = getDefaultPreferences(role);
  const builtins = BUILTIN_PRESETS.map((preset) => ({
    ...preset,
    source: "builtin",
    preferences: deepMerge(base, preset.preferences || {}),
  }));

  const custom = (Array.isArray(userPresets) ? userPresets : [])
    .filter((preset) => preset && preset.id && preset.name)
    .map((preset) => ({
      ...preset,
      source: "custom",
      preferences: deepMerge(base, preset.preferences || {}),
    }));

  return [...builtins, ...custom];
};

const normalizePreferences = (role, incoming) => {
  return deepMerge(getDefaultPreferences(role), incoming || {});
};

module.exports = {
  deepMerge,
  deepClone,
  getDefaultPreferences,
  getDefaultBoardState,
  buildPresetCatalog,
  normalizePreferences,
};
