const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "phase0-test-access-secret";
process.env.JWT_REFRESH_SECRET = "phase0-test-refresh-secret";
process.env.JWT_ACCESS_EXPIRY = "15m";
process.env.JWT_REFRESH_EXPIRY = "7d";
process.env.ALLOWED_ORIGINS = "http://localhost:5173";

jest.mock("../src/data/userData", () => ({
  createUser: jest.fn(),
  findUserByEmail: jest.fn(),
  findUserById: jest.fn(),
  findUsers: jest.fn(),
  updateUser: jest.fn(),
  comparePassword: jest.fn(),
}));
jest.mock("../src/data/auditLogData", () => ({
  log: jest.fn().mockResolvedValue(undefined),
  listAuditLogs: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 50 }),
}));
jest.mock("../src/services/email/emailService", () => ({
  sendLoginEmail: jest.fn().mockResolvedValue({ status: "skipped" }),
}));

const userData = require("../src/data/userData");
const app = require("../src/app");
const { refreshCookieOptions } = require("../src/controllers/authController");

const profile = { firstName: "Asha", lastName: "Kumar" };

describe("Phase 0 authentication and authorization baseline", () => {
  let users;
  let nextId;

  beforeEach(() => {
    users = [];
    nextId = 1;
    jest.clearAllMocks();

    userData.findUserByEmail.mockImplementation(async (email) =>
      users.find((user) => user.email === email) || null,
    );
    userData.findUserById.mockImplementation(async (id) =>
      users.find((user) => user.id === id) || null,
    );
    userData.createUser.mockImplementation(async ({ email, password, role, profile: userProfile }) => {
      const user = {
        id: `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`,
        email,
        password,
        role,
        profile: userProfile,
        status: "active",
        refresh_token: null,
        last_login: null,
        created_at: new Date().toISOString(),
      };
      users.push(user);
      return user;
    });
    userData.updateUser.mockImplementation(async (id, updates) => {
      const user = users.find((item) => item.id === id);
      if (!user) return null;
      Object.assign(user, updates);
      return user;
    });
    userData.comparePassword.mockImplementation(async (candidate, stored) => candidate === stored);
    userData.findUsers.mockImplementation(async () => users);
  });

  const register = (role, email) =>
    request(app).post("/api/auth/register").send({
      email,
      password: "CorrectHorseBatteryStaple!",
      role,
      profile,
    });

  test("normal client registration succeeds", async () => {
    const response = await register("client", "client@example.com");
    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe("client");
  });

  test("normal freelancer registration succeeds", async () => {
    const response = await register("freelancer", "freelancer@example.com");
    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe("freelancer");
  });

  test("registration accepts an empty optional phone field", async () => {
    const response = await request(app).post("/api/auth/register").send({
      email: "no-phone@example.com",
      password: "CorrectHorseBatteryStaple!",
      role: "freelancer",
      profile: { ...profile, phone: "" },
    });

    expect(response.status).toBe(201);
  });

  test("public admin registration fails", async () => {
    const response = await register("admin", "admin@example.com");
    expect(response.status).toBe(400);
    expect(userData.createUser).not.toHaveBeenCalled();
  });

  test("unknown public registration role fails", async () => {
    const response = await register("owner", "owner@example.com");
    expect(response.status).toBe(400);
    expect(userData.createUser).not.toHaveBeenCalled();
  });

  test("valid login returns an access token and protected refresh cookie", async () => {
    users.push({
      id: "00000000-0000-4000-8000-000000000010",
      email: "login@example.com",
      password: "valid-password",
      role: "client",
      profile,
      status: "active",
      refresh_token: null,
      last_login: null,
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "login@example.com",
      password: "valid-password",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("Path=/api/auth");
  });

  test("invalid login is rejected", async () => {
    users.push({
      id: "00000000-0000-4000-8000-000000000011",
      email: "invalid@example.com",
      password: "right-password",
      role: "client",
      profile,
      status: "active",
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "invalid@example.com",
      password: "wrong-password",
    });
    expect(response.status).toBe(401);
  });

  test("protected endpoint without authentication is rejected", async () => {
    const response = await request(app).get("/api/tasks/stats");
    expect(response.status).toBe(401);
  });

  test("blocked account cannot log in", async () => {
    users.push({
      id: "00000000-0000-4000-8000-000000000012",
      email: "blocked@example.com",
      password: "valid-password",
      role: "client",
      profile,
      status: "blocked",
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "blocked@example.com",
      password: "valid-password",
    });
    expect(response.status).toBe(403);
  });

  test("valid refresh rotates the refresh token", async () => {
    users.push({
      id: "00000000-0000-4000-8000-000000000013",
      email: "refresh@example.com",
      password: "valid-password",
      role: "freelancer",
      profile,
      status: "active",
      refresh_token: null,
      last_login: null,
    });
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "refresh@example.com",
      password: "valid-password",
    });
    expect(loginResponse.status).toBe(200);
    const refreshUpdate = userData.updateUser.mock.calls.find(
      ([, updates]) => typeof updates.refresh_token === "string",
    );
    expect(refreshUpdate).toBeDefined();
    const originalRefreshDigest = refreshUpdate[1].refresh_token;
    const originalRefreshToken = loginResponse.headers["set-cookie"][0]
      .match(/^refreshToken=([^;]+)/)[1];
    users[0].refresh_token = originalRefreshDigest;

    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`refreshToken=${originalRefreshToken}`]);
    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    const tokenUpdates = userData.updateUser.mock.calls.filter(
      ([, updates]) => typeof updates.refresh_token === "string",
    );
    expect(tokenUpdates.at(-1)[1].refresh_token).not.toBe(originalRefreshDigest);
  });

  test("invalid refresh token is rejected", async () => {
    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", ["refreshToken=not-a-valid-token"]);
    expect(response.status).toBe(401);
  });

  test("inactive account cannot refresh an otherwise valid session", async () => {
    users.push({
      id: "00000000-0000-4000-8000-000000000016",
      email: "inactive-refresh@example.com",
      password: "valid-password",
      role: "client",
      profile,
      status: "active",
      refresh_token: null,
      last_login: null,
    });
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "inactive-refresh@example.com",
      password: "valid-password",
    });
    const refreshCookie = loginResponse.headers["set-cookie"][0].match(/^refreshToken=([^;]+)/)[1];
    users[0].status = "suspended";

    const response = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`refreshToken=${refreshCookie}`]);

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe("Invalid refresh token");
  });

  test("logout revokes the refresh session without requiring an access token", async () => {
    users.push({
      id: "00000000-0000-4000-8000-000000000014",
      email: "logout@example.com",
      password: "valid-password",
      role: "client",
      profile,
      status: "active",
      refresh_token: null,
      last_login: null,
    });
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: "logout@example.com",
      password: "valid-password",
    });
    expect(loginResponse.status).toBe(200);
    const refreshUpdate = userData.updateUser.mock.calls.find(
      ([, updates]) => typeof updates.refresh_token === "string",
    );
    expect(refreshUpdate).toBeDefined();
    const refreshCookie = loginResponse.headers["set-cookie"][0]
      .match(/^refreshToken=([^;]+)/)[1];
    users[0].refresh_token = refreshUpdate[1].refresh_token;

    const response = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", [`refreshToken=${refreshCookie}`]);
    expect(response.status).toBe(200);
    expect(users[0].refresh_token).toBeNull();
  });

  test("client token cannot access an administrator operation", async () => {
    const user = {
      id: "00000000-0000-4000-8000-000000000015",
      email: "rbac@example.com",
      password: "valid-password",
      role: "client",
      profile,
      status: "active",
    };
    users.push(user);
    const loginResponse = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: user.password,
    });

    const response = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${loginResponse.body.data.accessToken}`);
    expect(response.status).toBe(403);
  });

  test("production refresh cookies stay HttpOnly, Secure, host-only, and auth-scoped", () => {
    const previous = {
      APP_ENV: process.env.APP_ENV,
      REFRESH_COOKIE_SAME_SITE: process.env.REFRESH_COOKIE_SAME_SITE,
    };
    process.env.APP_ENV = "production";
    process.env.REFRESH_COOKIE_SAME_SITE = "none";

    try {
      expect(refreshCookieOptions()).toEqual({
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/api/auth",
      });
      expect(refreshCookieOptions().domain).toBeUndefined();
    } finally {
      if (previous.APP_ENV === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previous.APP_ENV;
      if (previous.REFRESH_COOKIE_SAME_SITE === undefined) {
        delete process.env.REFRESH_COOKIE_SAME_SITE;
      } else {
        process.env.REFRESH_COOKIE_SAME_SITE = previous.REFRESH_COOKIE_SAME_SITE;
      }
    }
  });

  test("register, me, refresh after reload, logout, and second registration remain coherent", async () => {
    const registration = await register("client", "auth-flow-client@example.com");
    expect(registration.status).toBe(201);
    const initialAccessToken = registration.body.data.accessToken;
    const initialRefreshToken = registration.headers["set-cookie"][0]
      .match(/^refreshToken=([^;]+)/)[1];

    const initialMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${initialAccessToken}`);
    expect(initialMe.status).toBe(200);
    expect(initialMe.body.data.user.email).toBe("auth-flow-client@example.com");

    const refresh = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", [`refreshToken=${initialRefreshToken}`]);
    expect(refresh.status).toBe(200);
    const rotatedRefreshToken = refresh.headers["set-cookie"][0]
      .match(/^refreshToken=([^;]+)/)[1];

    const reloadedMe = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${refresh.body.data.accessToken}`);
    expect(reloadedMe.status).toBe(200);

    const logout = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", [`refreshToken=${rotatedRefreshToken}`]);
    expect(logout.status).toBe(200);
    expect(users[0].refresh_token).toBeNull();

    const secondRegistration = await register("freelancer", "auth-flow-freelancer@example.com");
    expect(secondRegistration.status).toBe(201);
    expect(secondRegistration.body.data.user.role).toBe("freelancer");
  });
});
