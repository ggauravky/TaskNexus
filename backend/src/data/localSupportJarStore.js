const path = require("path");
const {
  applyFilters,
  readCollection,
  withRecordMetadata,
  writeCollection,
} = require("./localStoreUtils");

const FILE_PATH = path.join(__dirname, "../../.local-data/support-jar-contributions.json");

const createContribution = async (payload) => {
  const contributions = readCollection(FILE_PATH);
  const record = withRecordMetadata({
    email_status: "pending",
    brevo_message_ids: null,
    ...payload,
  });

  contributions.push(record);
  writeCollection(FILE_PATH, contributions);
  return record;
};

const findContributionById = async (id) => {
  const contributions = readCollection(FILE_PATH);
  return contributions.find((contribution) => contribution.id === id) || null;
};

const findContributions = async (filters) => {
  const contributions = readCollection(FILE_PATH);
  return applyFilters(contributions, filters);
};

const updateContribution = async (id, updates) => {
  const contributions = readCollection(FILE_PATH);
  const index = contributions.findIndex((contribution) => contribution.id === id);

  if (index === -1) {
    return null;
  }

  contributions[index] = {
    ...contributions[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  writeCollection(FILE_PATH, contributions);
  return contributions[index];
};

module.exports = {
  createContribution,
  findContributionById,
  findContributions,
  updateContribution,
};
