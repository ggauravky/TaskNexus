const request = require("supertest");
const { validateEnvironment } = require("../src/config/environment");
const requireTrustedOrigin = require("../src/middleware/trustedOrigin");

process.env.NODE_ENV = "test";
process.env.APP_ENV = "test";
process.env.ALLOWED_ORIGINS = "http://localhost:5173";

describe("production runtime hardening", () => {
  test("accepts a complete isolated production contract", () => {
    const runtime = validateEnvironment({
      NODE_ENV: "production",
      APP_ENV: "production",
      APP_ORIGIN: "https://tasknexus.example",
      ALLOWED_ORIGINS: "https://tasknexus.example",
      MONGODB_URI: "mongodb+srv://example.invalid/app",
      MONGODB_DB_NAME: "tasknexus_production",
      JWT_ACCESS_SECRET: "a".repeat(48),
      JWT_REFRESH_SECRET: "b".repeat(48),
      UPLOAD_STORAGE_MODE: "gridfs",
      GRIDFS_BUCKET_NAME: "tasknexus_attachments_production",
      EMAIL_DELIVERY_MODE: "disabled",
    });
    expect(runtime).toMatchObject({ production: true, uploadMode: "gridfs", trustProxyHops: 1 });
  });

  test("rejects staging data, weak secrets, HTTP origin, and local production uploads", () => {
    expect(() => validateEnvironment({
      NODE_ENV: "production",
      APP_ENV: "production",
      APP_ORIGIN: "http://localhost:5173",
      MONGODB_URI: "mongodb://example.invalid/app",
      MONGODB_DB_NAME: "tasknexus_v2",
      JWT_ACCESS_SECRET: "same-short-secret",
      JWT_REFRESH_SECRET: "same-short-secret",
      UPLOAD_STORAGE_MODE: "local",
      EMAIL_DELIVERY_MODE: "disabled",
    })).toThrow(/Invalid runtime configuration/);
  });

  test("rejects a production application running with a non-production Node mode", () => {
    expect(() => validateEnvironment({
      NODE_ENV: "development",
      APP_ENV: "production",
      APP_ORIGIN: "https://tasknexus.example",
      MONGODB_URI: "mongodb://example.invalid/app",
      MONGODB_DB_NAME: "tasknexus_production",
      JWT_ACCESS_SECRET: "a".repeat(48),
      JWT_REFRESH_SECRET: "b".repeat(48),
      UPLOAD_STORAGE_MODE: "gridfs",
      GRIDFS_BUCKET_NAME: "tasknexus_attachments_production",
      EMAIL_DELIVERY_MODE: "disabled",
    })).toThrow(/NODE_ENV must be production/);
  });

  test("requires an exact trusted Origin for production cookie mutations", () => {
    const original = {
      APP_ENV: process.env.APP_ENV,
      APP_ORIGIN: process.env.APP_ORIGIN,
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    };
    process.env.APP_ENV = "production";
    process.env.APP_ORIGIN = "https://tasknexus.example";
    process.env.ALLOWED_ORIGINS = "https://admin.tasknexus.example";

    const invoke = (origin) => new Promise((resolve) => {
      requireTrustedOrigin({ get: () => origin }, {}, (error) => resolve(error));
    });

    return Promise.all([
      expect(invoke("https://tasknexus.example")).resolves.toBeUndefined(),
      expect(invoke("https://evil.example")).resolves.toMatchObject({ statusCode: 403 }),
      expect(invoke(undefined)).resolves.toMatchObject({ statusCode: 403 }),
    ]).finally(() => {
      process.env.APP_ENV = original.APP_ENV;
      if (original.APP_ORIGIN === undefined) delete process.env.APP_ORIGIN;
      else process.env.APP_ORIGIN = original.APP_ORIGIN;
      if (original.ALLOWED_ORIGINS === undefined) delete process.env.ALLOWED_ORIGINS;
      else process.env.ALLOWED_ORIGINS = original.ALLOWED_ORIGINS;
    });
  });

  test("liveness is independent from MongoDB and readiness reports it unavailable", async () => {
    const app = require("../src/app");
    const live = await request(app).get("/health");
    const ready = await request(app).get("/api/ready");
    expect(live.status).toBe(200);
    expect(live.body).toMatchObject({ status: "ok", request_id: expect.any(String) });
    expect(ready.status).toBe(503);
    expect(ready.body).toMatchObject({ status: "unavailable", checks: { database: "unavailable" } });
  }, 15000);

  test("parser failures use the canonical error envelope and request correlation", async () => {
    const app = require("../src/app");
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{");
    expect(response.status).toBe(400);
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.body).toMatchObject({
      success: false,
      error: { request_id: response.headers["x-request-id"] },
    });
  });

  test("rejects recognizable non-production database names in production", () => {
    for (const databaseName of [
      "tasknexus_v2_staging",
      "tasknexus-qa",
      "tasknexus_test",
      "tasknexus-performance",
    ]) {
      expect(() => validateEnvironment({
        NODE_ENV: "production",
        APP_ENV: "production",
        APP_ORIGIN: "https://tasknexus.example",
        MONGODB_URI: "mongodb://example.invalid/app",
        MONGODB_DB_NAME: databaseName,
        JWT_ACCESS_SECRET: "a".repeat(48),
        JWT_REFRESH_SECRET: "b".repeat(48),
        UPLOAD_STORAGE_MODE: "gridfs",
        GRIDFS_BUCKET_NAME: "tasknexus_attachments_production",
        EMAIL_DELIVERY_MODE: "disabled",
      })).toThrow(/development, test, QA, staging, or performance/);
    }
  });

  test("completed requests emit safe operational fields", async () => {
    const logger = require("../src/utils/logger");
    const info = jest.spyOn(logger, "info");
    await request(require("../src/app")).get("/health?ignored=secret");
    expect(info).toHaveBeenCalledWith("Request completed", expect.objectContaining({
      requestId: expect.any(String),
      method: "GET",
      route: "/health",
      status: 200,
      durationMs: expect.any(Number),
    }));
    info.mockRestore();
  });
});
