const mongoose = require("mongoose");

jest.mock("../src/utils/logger", () => ({ info: jest.fn(), error: jest.fn() }));

const database = require("../src/config/database");

describe("MongoDB connection", () => {
  const previous = { ...process.env };

  afterEach(() => {
    process.env = { ...previous };
    jest.restoreAllMocks();
  });

  test("requires a connection URI", async () => {
    delete process.env.MONGODB_URI;
    await expect(database.connectDatabase()).rejects.toThrow("MONGODB_URI is required");
  });

  test("uses the configured database and bounded pool settings", async () => {
    process.env.MONGODB_URI = "mongodb://example.invalid/ignored";
    process.env.MONGODB_DB_NAME = "tasknexus_test";
    const connect = jest.spyOn(mongoose, "connect").mockResolvedValue(mongoose);
    await database.connectDatabase();
    expect(connect).toHaveBeenCalledWith(process.env.MONGODB_URI, expect.objectContaining({
      dbName: "tasknexus_test", maxPoolSize: 20, serverSelectionTimeoutMS: 10000,
    }));
  });

  test("sanitizes driver errors and never repeats the connection URI", async () => {
    process.env.MONGODB_URI = "mongodb+srv://user:top-secret@example.invalid/db";
    jest.spyOn(mongoose, "connect").mockRejectedValue(Object.assign(new Error(process.env.MONGODB_URI), { code: "ENOTFOUND" }));
    await expect(database.connectDatabase()).rejects.toMatchObject({
      message: "MongoDB connection failed (ENOTFOUND)", code: "DATABASE_CONNECTION_FAILED",
    });
    await database.connectDatabase().catch((error) => expect(error.message).not.toContain("top-secret"));
  });
});
