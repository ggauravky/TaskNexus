const { Notification } = require("../models");
const { buildFilter, runMongo, toApp, toApps } = require("./mongoDataUtils");

const createNotification = (data) => runMongo(async () => toApp(await Notification.create(data)), "Unable to create notification");
const findNotifications = (filters) => runMongo(async () => toApps(await Notification.find(buildFilter(filters)).lean()), "Unable to find notifications");
const listNotifications = ({ filters = {}, page, limit }) => runMongo(async () => {
  const query = buildFilter(filters);
  const [items, total] = await Promise.all([
    Notification.find(query).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Notification.countDocuments(query),
  ]);
  return { items: toApps(items), total, page, limit };
}, "Unable to list notifications");
const updateNotification = (id, updates) => runMongo(async () => toApp(await Notification.findByIdAndUpdate(id, { $set: updates }, { returnDocument: "after", runValidators: true }).lean()), "Unable to update notification");
const updateManyNotifications = (filters, updates) => runMongo(async () => toApps(await Notification.find(buildFilter(filters)).lean().then(async (rows) => {
  await Notification.updateMany(buildFilter(filters), { $set: updates }, { runValidators: true });
  return rows.map((row) => ({ ...row, ...updates }));
})), "Unable to update notifications");
const deleteNotification = (id) => runMongo(async () => {
  const row = await Notification.findByIdAndDelete(id).lean();
  return row ? [toApp(row)] : [];
}, "Unable to delete notification");
const deleteManyNotifications = (filters) => runMongo(async () => {
  const query = buildFilter(filters);
  const rows = await Notification.find(query).lean();
  await Notification.deleteMany(query);
  return toApps(rows);
}, "Unable to delete notifications");

module.exports = { createNotification, findNotifications, listNotifications, updateNotification, updateManyNotifications, deleteNotification, deleteManyNotifications };
