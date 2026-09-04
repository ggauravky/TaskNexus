const mongoose = require("mongoose");

const withTransaction = async (work) => {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
};

const isDuplicateKey = (error) => error?.code === 11000;

module.exports = { isDuplicateKey, withTransaction };
