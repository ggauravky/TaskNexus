require("../src/config/loadEnv");
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");
const models = require("../src/models");

const apiBase = (process.argv[2] || "http://localhost:5000/api").replace(/\/$/, "");
const runId = randomUUID();
const password = `Tn-${randomBytes(18).toString("base64url")}9aA`;
const ids = { admin: randomUUID() };
const emails = {
  admin: `mongo-api-${runId}-admin@example.invalid`,
  client: `mongo-api-${runId}-client@example.invalid`,
  freelancer: `mongo-api-${runId}-freelancer@example.invalid`,
};

const call = async (path, { method = "GET", token, body } = {}) => {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  return { status: response.status, payload };
};

const register = async (role) => {
  const result = await call("/auth/register", {
    method: "POST",
    body: {
      email: emails[role], password, role,
      profile: { firstName: "Mongo", lastName: role === "client" ? "Client" : "Freelancer" },
    },
  });
  assert.equal(result.status, 201, `${role} registration failed`);
  ids[role] = result.payload.data.user.id;
  return result.payload.data.accessToken;
};

const expectOk = async (path, token) => {
  const result = await call(path, { token });
  assert.equal(result.status, 200, `${path} returned ${result.status}`);
  return result.payload;
};

const cleanup = async () => {
  const userIds = Object.values(ids).filter(Boolean);
  if (!userIds.length) return;
  const users = () => mongoose.trusted({ $in: userIds });
  await Promise.all([
    models.Notification.deleteMany({ recipient_id: users() }),
    models.AuditLog.deleteMany({ user_id: users() }),
    models.UserEducation.deleteMany({ user_id: users() }),
    models.UserSkill.deleteMany({ user_id: users() }),
    models.UserProfile.deleteMany({ _id: users() }),
    models.User.deleteMany({ _id: users() }),
  ]);
};

const run = async () => {
  await connectDatabase();
  try {
    await models.User.create({
      _id: ids.admin,
      email: emails.admin,
      password: await bcrypt.hash(password, Number(process.env.BCRYPT_SALT_ROUNDS) || 12),
      role: "admin",
      profile: { firstName: "Mongo", lastName: "Admin" },
    });
    await models.UserProfile.create({ _id: ids.admin });

    const clientToken = await register("client");
    const freelancerToken = await register("freelancer");
    for (const [role, token] of [["client", clientToken], ["freelancer", freelancerToken]]) {
      const me = await expectOk("/auth/me", token);
      assert.equal(me.data.user.role, role);
    }
    await expectOk("/client/profile", clientToken);
    await expectOk("/client/tasks?page=1&limit=10", clientToken);
    await expectOk("/freelancer/profile", freelancerToken);
    await expectOk("/freelancer/available-tasks", freelancerToken);
    await expectOk("/freelancer/my-tasks", freelancerToken);

    const adminLogin = await call("/auth/login", {
      method: "POST", body: { email: emails.admin, password },
    });
    assert.equal(adminLogin.status, 200, "admin login failed");
    const adminToken = adminLogin.payload.data.accessToken;
    const adminMe = await expectOk("/auth/me", adminToken);
    assert.equal(adminMe.data.user.role, "admin");
    await expectOk("/admin/users", adminToken);
    await expectOk("/admin/tasks", adminToken);
    await expectOk("/admin/audit-logs", adminToken);

    for (const token of [clientToken, freelancerToken, adminToken]) {
      const logout = await call("/auth/logout", { method: "POST", token });
      assert.equal(logout.status, 200);
    }
    process.stdout.write("MongoDB API verification passed: client, freelancer, and admin authentication and core reads.\n");
  } finally {
    await cleanup();
  }
};

run().catch((error) => {
  process.stderr.write(`MongoDB API verification failed: ${error.message}\n`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
