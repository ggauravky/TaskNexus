const { Payment } = require("../models");
const { buildFilter, runMongo, toApp, toApps } = require("./mongoDataUtils");

const createPayment = (data) => runMongo(async () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const payment_id = data.payment_id || `PAY-${dateStr}-${Math.floor(100000 + Math.random() * 900000)}`;
  return toApp(await Payment.create({ ...data, payment_id }));
}, "Unable to create payment");
const findPayments = (filters) => runMongo(async () => toApps(await Payment.find(buildFilter(filters)).lean()), "Unable to find payments");
const findPaymentById = (id) => runMongo(async () => toApp(await Payment.findById(id).lean()), "Unable to find payment");
const updatePayment = (id, updates) => runMongo(async () => toApp(await Payment.findByIdAndUpdate(id, { $set: updates }, { returnDocument: "after", runValidators: true }).lean()), "Unable to update payment");

module.exports = { createPayment, findPayments, findPaymentById, updatePayment };
