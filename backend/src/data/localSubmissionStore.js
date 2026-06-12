const path = require("path");
const {
  applyFilters,
  readCollection,
  withRecordMetadata,
  writeCollection,
} = require("./localStoreUtils");

const FILE_PATH = path.join(__dirname, "../../.local-data/submissions.json");

const createSubmission = async (payload) => {
  const submissions = readCollection(FILE_PATH);
  const record = withRecordMetadata(payload);
  submissions.push(record);
  writeCollection(FILE_PATH, submissions);
  return record;
};

const findSubmissions = async (filters) => {
  const submissions = readCollection(FILE_PATH);
  return applyFilters(submissions, filters);
};

const findSubmissionById = async (id) => {
  const submissions = readCollection(FILE_PATH);
  const submission = submissions.find((s) => s.id === id);
  if (!submission) return null;

  const localTaskStore = require("./localTaskStore");
  const task = await localTaskStore.findTaskById(submission.task_id);
  return {
    ...submission,
    task,
  };
};

const updateSubmission = async (id, updates) => {
  const submissions = readCollection(FILE_PATH);
  const index = submissions.findIndex((s) => s.id === id);
  if (index === -1) return null;

  submissions[index] = {
    ...submissions[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  writeCollection(FILE_PATH, submissions);
  return submissions[index];
};

module.exports = {
  createSubmission,
  findSubmissions,
  findSubmissionById,
  updateSubmission,
};
