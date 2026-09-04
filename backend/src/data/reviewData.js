const { Review } = require("../models");
const { buildFilter, runMongo, toApp, toApps } = require("./mongoDataUtils");

const createReview = (data) => runMongo(async () => toApp(await Review.create(data)), "Unable to create review");
const findReviews = (filters) => runMongo(async () => toApps(await Review.find(buildFilter(filters)).lean()), "Unable to find reviews");
const getAverageRating = (userId) => runMongo(async () => {
  const [result] = await Review.aggregate([{ $match: { reviewee_id: userId } }, { $group: { _id: null, averageRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } }]);
  return result ? { averageRating: result.averageRating, totalReviews: result.totalReviews } : { averageRating: 0, totalReviews: 0 };
}, "Unable to calculate rating");

module.exports = { createReview, findReviews, getAverageRating };
