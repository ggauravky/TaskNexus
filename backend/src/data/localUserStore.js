const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { USER_STATUS } = require("../config/constants");

const LOCAL_DATA_DIR = path.join(__dirname, "../../.local-data");
const USERS_FILE = path.join(LOCAL_DATA_DIR, "users.json");

const ensureLocalStore = () => {
  if (!fs.existsSync(LOCAL_DATA_DIR)) {
    fs.mkdirSync(LOCAL_DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, "[]", "utf8");
  }
};

const readUsers = () => {
  ensureLocalStore();

  try {
    const fileContent = fs.readFileSync(USERS_FILE, "utf8");
    const parsed = JSON.parse(fileContent);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const writeUsers = (users) => {
  ensureLocalStore();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const applyFilters = (users, filters = {}) => {
  return users.filter((user) =>
    Object.entries(filters).every(([key, value]) => {
      if (key.includes("->")) {
        const [jsonField, property] = key.split("->");
        const target = user[jsonField];
        if (!target || typeof target !== "object") {
          return false;
        }
        if (Array.isArray(value)) {
          return value.includes(target[property]);
        }
        return target[property] === value;
      }

      if (Array.isArray(value)) {
        return value.includes(user[key]);
      }

      return user[key] === value;
    })
  );
};

const createUser = async (userData) => {
  const users = readUsers();
  const email = normalizeEmail(userData.email);
  const now = new Date().toISOString();

  const user = {
    id: crypto.randomUUID(),
    email,
    password: userData.password,
    role: userData.role,
    profile: userData.profile || {},
    freelancer_profile: userData.freelancerProfile || null,
    client_profile: userData.clientProfile || null,
    status: USER_STATUS.ACTIVE,
    refresh_token: null,
    last_login: null,
    created_at: now,
    updated_at: now,
  };

  users.push(user);
  writeUsers(users);

  return user;
};

const findUserByEmail = async (email) => {
  const users = readUsers();
  const normalizedEmail = normalizeEmail(email);
  return users.find((user) => normalizeEmail(user.email) === normalizedEmail) || null;
};

const findUserById = async (id) => {
  const users = readUsers();
  return users.find((user) => user.id === id) || null;
};

const findUsers = async (filters) => {
  const users = readUsers();
  if (!filters || Object.keys(filters).length === 0) {
    return users;
  }
  return applyFilters(users, filters);
};

const listUsers = async ({ filters = {}, page, limit, sortBy, sortOrder, search }) => {
  let users = applyFilters(readUsers(), filters);
  if (search) {
    const needle = search.toLowerCase();
    users = users.filter((user) => {
      const name = `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.toLowerCase();
      return user.email.toLowerCase().includes(needle) || name.includes(needle);
    });
  }
  users.sort((left, right) => {
    const result = String(left[sortBy] || "").localeCompare(String(right[sortBy] || ""));
    return sortOrder === "asc" ? result : -result;
  });
  const total = users.length;
  const start = (page - 1) * limit;
  return { items: users.slice(start, start + limit), total, page, limit };
};

const updateUser = async (id, updates) => {
  const users = readUsers();
  const userIndex = users.findIndex((user) => user.id === id);

  if (userIndex === -1) {
    return null;
  }

  const normalizedUpdates = { ...updates };
  if (normalizedUpdates.last_login instanceof Date) {
    normalizedUpdates.last_login = normalizedUpdates.last_login.toISOString();
  }

  users[userIndex] = {
    ...users[userIndex],
    ...normalizedUpdates,
    updated_at: new Date().toISOString(),
  };

  writeUsers(users);
  return users[userIndex];
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  findUsers,
  listUsers,
  updateUser,
};
