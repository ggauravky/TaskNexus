const { ServiceBooking } = require("../models");
const { runMongo, toApp } = require("./mongoDataUtils");

const createBooking = (data) => runMongo(async () => toApp(await ServiceBooking.create(data)), "Unable to create service booking");
const findBookingById = (id) => runMongo(async () => toApp(await ServiceBooking.findById(id).lean()), "Unable to find service booking");
const updateBooking = (id, updates) => runMongo(async () => toApp(await ServiceBooking.findByIdAndUpdate(id, { $set: updates }, { returnDocument: "after", runValidators: true }).lean()), "Unable to update service booking");

module.exports = { createBooking, findBookingById, updateBooking };
