const path = require("path");
const {
  applyFilters,
  readCollection,
  withRecordMetadata,
  writeCollection,
} = require("./localStoreUtils");

const FILE_PATH = path.join(__dirname, "../../.local-data/notifications.json");

const createNotification = async (payload) => {
  const notifications = readCollection(FILE_PATH);
  const record = withRecordMetadata({
    status: "unread",
    priority: "medium",
    ...payload,
  });
  notifications.push(record);
  writeCollection(FILE_PATH, notifications);
  return record;
};

const findNotifications = async (filters) => {
  const notifications = readCollection(FILE_PATH);
  return applyFilters(notifications, filters);
};

const listNotifications = async ({ filters, page, limit }) => {
  const notifications = applyFilters(readCollection(FILE_PATH), filters)
    .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
  const total = notifications.length;
  const start = (page - 1) * limit;
  return { items: notifications.slice(start, start + limit), total, page, limit };
};

const updateNotification = async (id, updates) => {
  const notifications = readCollection(FILE_PATH);
  const index = notifications.findIndex((n) => n.id === id);
  if (index === -1) return null;

  notifications[index] = {
    ...notifications[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  writeCollection(FILE_PATH, notifications);
  return notifications[index];
};

const updateManyNotifications = async (filters, updates) => {
  const notifications = readCollection(FILE_PATH);
  const filtered = applyFilters(notifications, filters);
  const updatedIds = new Set(filtered.map((n) => n.id));
  const now = new Date().toISOString();

  const result = [];
  const nextNotifications = notifications.map((n) => {
    if (updatedIds.has(n.id)) {
      const updated = {
        ...n,
        ...updates,
        updated_at: now,
      };
      result.push(updated);
      return updated;
    }
    return n;
  });

  writeCollection(FILE_PATH, nextNotifications);
  return result;
};

const deleteNotification = async (id) => {
  const notifications = readCollection(FILE_PATH);
  const filtered = notifications.filter((n) => n.id !== id);
  const deleted = notifications.filter((n) => n.id === id);
  writeCollection(FILE_PATH, filtered);
  return deleted;
};

const deleteManyNotifications = async (filters) => {
  const notifications = readCollection(FILE_PATH);
  const toDelete = applyFilters(notifications, filters);
  const deleteIds = new Set(toDelete.map((n) => n.id));
  const remaining = notifications.filter((n) => !deleteIds.has(n.id));
  writeCollection(FILE_PATH, remaining);
  return toDelete;
};

module.exports = {
  createNotification,
  findNotifications,
  listNotifications,
  updateNotification,
  updateManyNotifications,
  deleteNotification,
  deleteManyNotifications,
};
