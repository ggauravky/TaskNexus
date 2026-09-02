const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const LOCAL_DATA_DIR = path.join(__dirname, "../../.local-data");
const TASKS_FILE = path.join(LOCAL_DATA_DIR, "tasks.json");

const ensureLocalStore = () => {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(TASKS_FILE)) {
    fs.writeFileSync(TASKS_FILE, "[]", "utf8");
  }
};

const readTasks = () => {
  ensureLocalStore();

  try {
    const fileContent = fs.readFileSync(TASKS_FILE, "utf8");
    const parsed = JSON.parse(fileContent);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const writeTasks = (tasks) => {
  ensureLocalStore();
  fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), "utf8");
};

const readJsonPath = (obj, key) => {
  if (!obj || typeof obj !== "object") return undefined;
  return obj[key];
};

const matchesFilter = (task, key, value) => {
  if (key.includes("->>")) {
    const [column, jsonKey] = key.split("->>");
    const target = readJsonPath(task[column], jsonKey);
    return String(target ?? "") === String(value ?? "");
  }

  if (key.includes("->")) {
    const [column, jsonKey] = key.split("->");
    const target = readJsonPath(task[column], jsonKey);
    return target === value;
  }

  if (value === null) {
    return task[key] === null || task[key] === undefined;
  }

  if (Array.isArray(value)) {
    return value.includes(task[key]);
  }

  return task[key] === value;
};

const applyFilters = (tasks, filters = {}) => {
  return tasks.filter((task) =>
    Object.entries(filters).every(([key, value]) => matchesFilter(task, key, value))
  );
};

const createTask = async (taskData) => {
  const tasks = readTasks();
  const now = new Date().toISOString();

  const task = {
    id: taskData.id || crypto.randomUUID(),
    ...taskData,
    created_at: taskData.created_at || now,
    updated_at: taskData.updated_at || now,
  };

  tasks.push(task);
  writeTasks(tasks);
  return task;
};

const findTaskById = async (id) => {
  const tasks = readTasks();
  return tasks.find((task) => task.id === id) || null;
};

const findTasks = async (filters) => {
  const tasks = readTasks();
  if (!filters || Object.keys(filters).length === 0) {
    return tasks;
  }
  return applyFilters(tasks, filters);
};

const listTasks = async ({ filters = {}, page, limit, sortBy, sortOrder, search }) => {
  let tasks = applyFilters(readTasks(), filters);
  if (search) {
    const needle = search.toLowerCase();
    tasks = tasks.filter((task) =>
      String(task.task_details?.title || "").toLowerCase().includes(needle),
    );
  }
  tasks.sort((left, right) => {
    const result = String(left[sortBy] || "").localeCompare(String(right[sortBy] || ""));
    return sortOrder === "asc" ? result : -result;
  });
  const total = tasks.length;
  const start = (page - 1) * limit;
  return { items: tasks.slice(start, start + limit), total, page, limit };
};

const updateTask = async (id, updates) => {
  const tasks = readTasks();
  const index = tasks.findIndex((task) => task.id === id);

  if (index === -1) {
    return null;
  }

  tasks[index] = {
    ...tasks[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  writeTasks(tasks);
  return tasks[index];
};

const updateTaskIfStatus = async (id, expectedStatus, updates) => {
  const tasks = readTasks();
  const index = tasks.findIndex(
    (task) => task.id === id && task.status === expectedStatus,
  );
  if (index === -1) return null;

  tasks[index] = {
    ...tasks[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  writeTasks(tasks);
  return tasks[index];
};

const acceptTaskAtomically = async (id, freelancerId) => {
  const tasks = readTasks();
  const index = tasks.findIndex(
    (task) =>
      task.id === id &&
      task.status === "under_review" &&
      !task.freelancer_id,
  );
  if (index === -1) return null;

  tasks[index] = {
    ...tasks[index],
    freelancer_id: freelancerId,
    status: "assigned",
    workflow: {
      ...(tasks[index].workflow || {}),
      assignedAt: new Date().toISOString(),
    },
    updated_at: new Date().toISOString(),
  };
  writeTasks(tasks);
  return tasks[index];
};

module.exports = {
  createTask,
  findTaskById,
  findTasks,
  listTasks,
  updateTask,
  updateTaskIfStatus,
  acceptTaskAtomically,
};
