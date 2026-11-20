const mongoose = require("mongoose");
const { Payment, Submission, Task } = require("../models");
const { buildFilter, runMongo, toApp, toApps } = require("./mongoDataUtils");
const { errors } = require("../utils/appError");
const { withTransaction } = require("../utils/transactions");
const { TASK_STATUS, PAYMENT_STATUS } = require("../config/constants");
const paymentData = require("./paymentData");
const auditLogData = require("./auditLogData");
const notificationData = require("./notificationData");

const submitWorkAtomically = ({ taskId, freelancerId, content, submissionType, idempotencyKey }) => runMongo(async () => {
  const existing = idempotencyKey ? await Submission.findOne({ freelancer_id: freelancerId, idempotency_key: idempotencyKey }).lean() : null;
  if (existing) return { task: toApp(await Task.findById(existing.task_id).lean()), submission: toApp(existing) };
  const session = await mongoose.startSession();
  let result = null;
  try {
    await session.withTransaction(async () => {
      const task = await Task.findOneAndUpdate(
        { _id: taskId, freelancer_id: freelancerId, status: "in_progress" },
        { $set: { status: "delivered", "workflow.deliveredAt": new Date().toISOString() } },
        { returnDocument: "after", runValidators: true, session },
      );
      if (!task) return;
      const latest = await Submission.findOne({ task_id: taskId }).sort({ version: -1 }).session(session).lean();
      await Submission.updateMany({ task_id: taskId, is_active: true }, { $set: { is_active: false } }, { session });
      const [submission] = await Submission.create([{
        task_id: taskId, freelancer_id: freelancerId, submission_type: submissionType,
        content, version: (latest?.version || 0) + 1, is_active: true, idempotency_key: idempotencyKey || null,
        client_review: { status: "pending", reviewedAt: null, feedback: "" },
      }], { session });
      result = { task: toApp(task), submission: toApp(submission) };
    });
  } catch (error) {
    if (error?.code === 11000 && idempotencyKey) {
      const duplicate = await Submission.findOne({ freelancer_id: freelancerId, idempotency_key: idempotencyKey }).lean();
      if (duplicate) return { task: toApp(await Task.findById(duplicate.task_id).lean()), submission: toApp(duplicate) };
    }
    throw error;
  } finally { await session.endSession(); }
  return result;
}, "Unable to submit task work");

const createSubmission = (submissionData) => runMongo(async () => toApp(await Submission.create(submissionData)), "Unable to create submission");
const findSubmissions = (filters) => runMongo(async () => toApps(await Submission.find(buildFilter(filters)).lean()), "Unable to find submissions");
const listRecentSubmissions = (taskId, limit = 25) => runMongo(async () => {
  const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 25);
  const submissions = await Submission.find({ task_id: taskId })
    .sort({ version: -1, created_at: -1, _id: -1 })
    .limit(safeLimit)
    .lean();
  return toApps(submissions);
}, "Unable to list recent submissions");
const findSubmissionById = (id) => runMongo(async () => {
  const submission = toApp(await Submission.findById(id).lean());
  if (submission) submission.task = toApp(await Task.findById(submission.task_id).lean());
  return submission;
}, "Unable to find submission");
const getRevisionCount = (taskId) => runMongo(() => Submission.countDocuments({ task_id: taskId, submission_type: "revision" }), "Unable to count revisions");
const summarizeQaReviews = (freelancerId) => runMongo(async () => {
  const [summary] = await Submission.aggregate([
    { $match: { freelancer_id: freelancerId } },
    { $group: {
      _id: null, total: { $sum: 1 },
      approved: { $sum: { $cond: [{ $eq: ["$qa_review.status", "approved"] }, 1, 0] } },
    } },
  ]);
  return summary || { total: 0, approved: 0 };
}, "Unable to summarize QA reviews");

const reviewSubmissionAtomically = ({ submissionId, clientId, action, feedback, ip }) => runMongo(
  () => withTransaction(async (session) => {
    const submission = await Submission.findById(submissionId).session(session).lean();
    if (!submission) throw errors.notFound("Submission not found");
    const task = await Task.findById(submission.task_id).session(session).lean();
    if (!task) throw errors.notFound("Task not found");
    if (task.client_id !== clientId) throw errors.forbidden("Not authorized to review this submission");
    if (submission.is_active !== true || submission.client_review?.status !== "pending") {
      throw errors.validation("Submission is no longer available for review");
    }
    if (task.status !== TASK_STATUS.DELIVERED || task.freelancer_id !== submission.freelancer_id) {
      throw errors.validation("Task is not in delivered status for this submission");
    }
    const approve = action === "approve";
    if (approve && await Payment.exists({ task_id: task._id }).session(session)) {
      throw errors.conflict("Existing payment record requires reconciliation");
    }
    if (!approve) {
      const used = await Submission.countDocuments({ task_id: submission.task_id, submission_type: "revision" }).session(session);
      const configuredLimit = Number(task.task_details.revisionLimit ?? 2);
      if (!Number.isInteger(configuredLimit) || configuredLimit < 0 || used >= configuredLimit) {
        throw errors.validation("Revision limit exceeded for this task");
      }
    }

    const now = new Date();
    const updatedTask = await Task.findOneAndUpdate({
      _id: task._id, client_id: clientId, freelancer_id: submission.freelancer_id, status: TASK_STATUS.DELIVERED,
    }, { $set: {
      status: approve ? TASK_STATUS.COMPLETED : TASK_STATUS.CLIENT_REVISION,
      ...(approve ? { workflow: { ...task.workflow, completedAt: now } } : {}),
    } }, { session, returnDocument: "after", runValidators: true }).lean();
    if (!updatedTask) throw errors.conflict("Task changed during submission review");

    const updatedSubmission = await Submission.findOneAndUpdate({
      _id: submissionId, task_id: task._id, is_active: true, "client_review.status": "pending",
    }, { $set: { client_review: {
      status: approve ? "approved" : "revision_requested", reviewedAt: now, feedback,
    } } }, { session, returnDocument: "after", runValidators: true }).lean();
    if (!updatedSubmission) throw errors.conflict("Submission changed during review");

    if (approve) {
      const taskBudget = task.task_details.budget;
      const platformCommission = 15;
      const platformFee = (taskBudget * platformCommission) / 100;
      await paymentData.createPayment({
        task_id: task._id, client_id: clientId, freelancer_id: task.freelancer_id,
        amounts: { taskBudget, platformCommission, platformFee, freelancerPayout: taskBudget - platformFee },
        status: PAYMENT_STATUS.ESCROWED, escrow: { heldAt: now },
      }, session);
    }
    await auditLogData.log({
      user_id: clientId, action: `submission_${action}`, resource: "submission", resource_id: submissionId,
      changes: { taskId: task._id, feedback, action }, ip_address: ip,
    }, session);
    const notification = await notificationData.createNotification({
      recipient_id: submission.freelancer_id,
      type: approve ? "submission_approved" : "revision_requested",
      content: {
        title: approve ? "Submission Approved" : "Revision Requested",
        message: approve
          ? `Your submission for task "${task.task_details.title}" has been approved!`
          : `Client has requested revisions for task "${task.task_details.title}"`,
      },
      related_task_id: task._id,
    }, session);
    return { task: toApp(updatedTask), submission: toApp(updatedSubmission), notification };
  }),
  "Unable to review submission",
);

const resubmitReviewedWork = ({ submissionId, freelancerId, deliverables, comments, ip }) => runMongo(
  () => withTransaction(async (session) => {
    const previous = await Submission.findById(submissionId).session(session).lean();
    if (!previous) throw errors.notFound("Submission not found");
    if (previous.freelancer_id !== freelancerId) throw errors.forbidden("Not authorized to update this submission");
    if (previous.is_active !== true || previous.client_review?.status !== "revision_requested") {
      throw errors.validation("This submission cannot be updated - no revision requested");
    }
    const task = await Task.findById(previous.task_id).session(session).lean();
    if (!task) throw errors.notFound("Task not found");
    if (task.freelancer_id !== freelancerId) throw errors.forbidden("You are not assigned to this task");
    if (task.status !== TASK_STATUS.CLIENT_REVISION) throw errors.conflict("Task is no longer awaiting revision");
    const now = new Date();
    const revisionsUsed = Number(task.metrics?.revisionsUsed) || 0;
    const updatedTask = await Task.findOneAndUpdate({
      _id: task._id, freelancer_id: freelancerId, status: TASK_STATUS.CLIENT_REVISION,
    }, { $set: {
      status: TASK_STATUS.DELIVERED,
      workflow: { ...task.workflow, deliveredAt: now },
      metrics: { ...task.metrics, revisionsUsed: revisionsUsed + 1 },
    } }, { session, returnDocument: "after", runValidators: true }).lean();
    if (!updatedTask) throw errors.conflict("Task changed during resubmission");
    const deactivated = await Submission.updateOne({
      _id: submissionId, task_id: task._id, is_active: true, "client_review.status": "revision_requested",
    }, { $set: { is_active: false } }, { session });
    if (deactivated.modifiedCount !== 1) throw errors.conflict("Submission changed during resubmission");
    const latest = await Submission.findOne({ task_id: task._id }).sort({ version: -1 }).select("version").session(session).lean();
    const [submission] = await Submission.create([{
      task_id: task._id, freelancer_id: freelancerId, submission_type: "revision",
      version: (latest?.version || 0) + 1, is_active: true,
      content: { ...previous.content, deliverables: deliverables || previous.content?.deliverables, notes: comments || previous.content?.notes },
      client_review: { status: "pending", reviewedAt: null, feedback: "" },
    }], { session });
    const notification = await notificationData.createNotification({
      recipient_id: task.client_id, type: "submission_updated", related_task_id: task._id,
      content: { title: "Submission Updated", message: "Freelancer has updated the submission with your requested revisions" },
    }, session);
    await auditLogData.log({
      user_id: freelancerId, action: "submission_revision_submitted", resource: "submission", resource_id: submission._id,
      changes: { taskId: task._id, previousSubmissionId: submissionId }, ip_address: ip,
    }, session);
    return { task: toApp(updatedTask), submission: toApp(submission), notification };
  }),
  "Unable to resubmit work",
);

module.exports = {
  submitWorkAtomically,
  reviewSubmissionAtomically,
  resubmitReviewedWork,
  createSubmission,
  findSubmissions,
  listRecentSubmissions,
  findSubmissionById,
  getRevisionCount,
  summarizeQaReviews,
};
