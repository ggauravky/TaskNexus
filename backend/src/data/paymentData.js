const { Payment } = require("../models");
const { buildFilter, runMongo, toApp, toApps, trustedOperators } = require("./mongoDataUtils");
const { errors } = require("../utils/appError");
const { withTransaction } = require("../utils/transactions");
const auditLogData = require("./auditLogData");

const insertPayment = async (data, session) => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const payment_id = data.payment_id || `PAY-${dateStr}-${Math.floor(100000 + Math.random() * 900000)}`;
  const [record] = await Payment.create([{ ...data, payment_id }], { session });
  return toApp(record);
};
const createPayment = (data, session = null) => session
  ? insertPayment(data, session)
  : runMongo(() => insertPayment(data, null), "Unable to create payment");
const findPayments = (filters) => runMongo(async () => toApps(await Payment.find(buildFilter(filters)).lean()), "Unable to find payments");
const findPaymentById = (id) => runMongo(async () => toApp(await Payment.findById(id).lean()), "Unable to find payment");
const sumDashboardPayments = (owner, field, statuses) => runMongo(async () => {
  const rows = await Payment.aggregate([
    { $match: { ...owner, status: { $in: statuses } } },
    { $group: { _id: { $eq: ["$status", "released"] }, amount: { $sum: field } } },
  ]);
  return {
    released: rows.find((row) => row._id === true)?.amount || 0,
    pending: rows.find((row) => row._id === false)?.amount || 0,
  };
}, "Unable to summarize dashboard payments");
const summarizeClientPayments = (clientId) => sumDashboardPayments({ client_id: clientId }, "$amounts.taskBudget", ["released"]);
const summarizeFreelancerPayments = (freelancerId) => sumDashboardPayments(
  { freelancer_id: freelancerId }, "$amounts.freelancerPayout", ["released", "pending", "escrowed"],
);
const resolveDispute = ({ taskId, decision, notes, actorId, ip }) => runMongo(() => withTransaction(async (session) => {
  const records = await Payment.find({ task_id: taskId }).select("_id escrow").limit(2).session(session).lean();
  if (!records.length) throw errors.notFound("No payment record exists for this dispute");
  if (records.length !== 1) throw errors.conflict("Multiple payment records require reconciliation");
  const now = new Date().toISOString();
  const isRefund = decision === "refund_client";
  const result = await Payment.updateOne({
    _id: records[0]._id, status: trustedOperators({ $in: ["pending", "escrowed"] }),
  }, {
    $set: {
      status: isRefund ? "refunded" : "released",
      escrow: { ...records[0].escrow, releasedAt: now },
      ...(isRefund ? { refund: { refundedAt: now, reason: notes || decision } } : {}),
    },
  }, { session, runValidators: true });
  if (result.modifiedCount !== 1) throw errors.conflict("Payment record is already resolved");
  await auditLogData.log({
    user_id: actorId, action: "dispute_resolved", resource: "task", resource_id: taskId,
    changes: { resolution: decision, notes }, ip_address: ip,
  }, session);
}), "Unable to resolve dispute");

module.exports = { createPayment, findPayments, findPaymentById, resolveDispute, summarizeClientPayments, summarizeFreelancerPayments };
