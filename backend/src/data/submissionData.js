const mongoose = require("mongoose");
const { Submission, Task } = require("../models");
const { buildFilter, runMongo, toApp, toApps } = require("./mongoDataUtils");

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
const findSubmissionById = (id) => runMongo(async () => {
  const submission = toApp(await Submission.findById(id).lean());
  if (submission) submission.task = toApp(await Task.findById(submission.task_id).lean());
  return submission;
}, "Unable to find submission");
const updateSubmission = (id, updates) => runMongo(async () => toApp(await Submission.findByIdAndUpdate(id, { $set: updates }, { returnDocument: "after", runValidators: true }).lean()), "Unable to update submission");
const getRevisionCount = (taskId) => runMongo(() => Submission.countDocuments({ task_id: taskId, submission_type: "revision" }), "Unable to count revisions");

module.exports = { submitWorkAtomically, createSubmission, findSubmissions, findSubmissionById, updateSubmission, getRevisionCount };
