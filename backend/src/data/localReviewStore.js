const path = require("path");
const {
  applyFilters,
  readCollection,
  withRecordMetadata,
  writeCollection,
} = require("./localStoreUtils");

const FILE_PATH = path.join(__dirname, "../../.local-data/reviews.json");

const createReview = async (payload) => {
  const reviews = readCollection(FILE_PATH);
  const record = withRecordMetadata(payload);
  reviews.push(record);
  writeCollection(FILE_PATH, reviews);
  return record;
};

const findReviews = async (filters) => {
  const reviews = readCollection(FILE_PATH);
  return applyFilters(reviews, filters);
};

module.exports = {
  createReview,
  findReviews,
};
