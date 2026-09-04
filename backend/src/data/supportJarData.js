const { SupportContribution } = require("../models");
const { runMongo, toApp } = require("./mongoDataUtils");

const createContribution = (data) => runMongo(async () => toApp(await SupportContribution.create(data)), "Unable to create support contribution");
const findContributionById = (id) => runMongo(async () => toApp(await SupportContribution.findById(id).lean()), "Unable to find support contribution");
const updateContribution = (id, updates) => runMongo(async () => toApp(await SupportContribution.findByIdAndUpdate(id, { $set: updates }, { returnDocument: "after", runValidators: true }).lean()), "Unable to update support contribution");

module.exports = { createContribution, findContributionById, updateContribution };
