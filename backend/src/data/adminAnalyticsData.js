const { Payment, Review, Task, User } = require("../models");
const { toApps } = require("../models/helpers");

const numeric = (field) => ({
  $convert: { input: field, to: "double", onError: 0, onNull: 0 },
});

const first = (rows = []) => rows[0] || {};

const getDashboardSummary = async () => {
  const [userRows, taskRows, paymentRows] = await Promise.all([
    User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
    Task.aggregate([{ $facet: {
      byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
      recent: [{ $sort: { updated_at: -1, _id: 1 } }, { $limit: 10 }],
      total: [{ $count: "value" }],
    } }]),
    Payment.aggregate([
      { $match: { status: "released" } },
      { $group: { _id: null, value: { $sum: numeric("$amounts.platformFee") } } },
    ]),
  ]);

  const taskSummary = first(taskRows);
  const userCounts = new Map(userRows.map((row) => [row._id, row.count]));
  return {
    users: {
      total: userRows.reduce((sum, row) => sum + row.count, 0),
      clients: userCounts.get("client") || 0,
      freelancers: userCounts.get("freelancer") || 0,
    },
    tasks: {
      total: taskSummary.total?.[0]?.value || 0,
      byStatus: (taskSummary.byStatus || []).map((row) => ({ status: row._id, count: row.count })),
    },
    platformRevenue: first(paymentRows).value || 0,
    recentTasks: toApps(taskSummary.recent || []),
  };
};

const getStatistics = async (monthStart) => {
  const [taskRows, userRows, paymentRows, reviewRows] = await Promise.all([
    Task.aggregate([{ $facet: {
      summary: [{ $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        averageCompletionTime: { $avg: { $cond: [
          { $eq: ["$status", "completed"] },
          { $divide: [{ $subtract: ["$updated_at", "$created_at"] }, 86400000] },
          null,
        ] } },
      } }],
      byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
      newThisMonth: [{ $match: { created_at: { $gte: monthStart } } }, { $count: "value" }],
    } }]),
    User.aggregate([{ $facet: {
      summary: [{ $group: {
        _id: null,
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
      } }],
      byRole: [{ $group: { _id: "$role", count: { $sum: 1 } } }],
      newThisMonth: [{ $match: { created_at: { $gte: monthStart } } }, { $count: "value" }],
    } }]),
    Payment.aggregate([{ $facet: {
      released: [
        { $match: { status: "released" } },
        { $group: {
          _id: null,
          amount: { $sum: numeric({ $ifNull: ["$amounts.total", "$amount"] }) },
          count: { $sum: 1 },
          platformRevenue: { $sum: numeric("$amounts.platformFee") },
        } },
      ],
      pending: [
        { $match: { status: { $in: ["pending", "escrowed"] } } },
        { $group: {
          _id: null,
          amount: { $sum: numeric({ $ifNull: ["$amounts.total", "$amount"] }) },
          count: { $sum: 1 },
        } },
      ],
    } }]),
    Review.aggregate([
      { $match: { rating: { $gt: 0 } } },
      { $group: { _id: null, average: { $avg: "$rating" } } },
    ]),
  ]);

  const task = first(first(taskRows).summary);
  const users = first(first(userRows).summary);
  const payments = first(paymentRows);
  const released = first(payments.released);
  const pending = first(payments.pending);
  const roleCounts = new Map((first(userRows).byRole || []).map((row) => [row._id, row.count]));
  const statusCounts = Object.fromEntries(
    (first(taskRows).byStatus || []).map((row) => [row._id, row.count]),
  );
  const averageRating = first(reviewRows).average || 0;

  return {
    totalRevenue: released.platformRevenue || 0,
    platformRevenue: released.platformRevenue || 0,
    activeUsers: users.active || 0,
    totalUsers: users.total || 0,
    totalTasks: task.total || 0,
    completionRate: task.total ? ((task.completed || 0) / task.total) * 100 : 0,
    tasksByStatus: statusCounts,
    usersByRole: {
      clients: roleCounts.get("client") || 0,
      freelancers: roleCounts.get("freelancer") || 0,
      admins: roleCounts.get("admin") || 0,
    },
    paymentStats: {
      completed: released.amount || 0,
      completedCount: released.count || 0,
      pending: pending.amount || 0,
      pendingCount: pending.count || 0,
    },
    growth: {
      newUsers: first(first(userRows).newThisMonth).value || 0,
      newTasks: first(first(taskRows).newThisMonth).value || 0,
    },
    averageCompletionTime: task.averageCompletionTime || 0,
    satisfactionRate: averageRating ? (averageRating / 5) * 100 : 0,
  };
};

module.exports = { getDashboardSummary, getStatistics };
