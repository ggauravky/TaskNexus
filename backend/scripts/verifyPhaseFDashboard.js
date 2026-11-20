require("../src/config/loadEnv");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const mongoose = require("mongoose");
const { assertStagingMutationAllowed } = require("./lib/stagingSafety");

assertStagingMutationAllowed();
const target = new URL(process.env.MONGODB_URI);
assert.equal(target.protocol, "mongodb:");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname), "Dashboard fixtures require disposable loopback Mongo");
process.env.EMAIL_ENABLED = "false";

const app = require("../src/app");
const { databaseName, disconnectDatabase } = require("../src/config/database");
const { generateAccessToken } = require("../src/config/jwt");
const { User, Task, Payment, Review, Submission } = require("../src/models");
const samples = 12;
const datasetSizes = [0, 1, 100, 1000, 10000];
const statuses = ["completed", "delivered", "in_progress", "cancelled"];
const median = (values) => percentile(values, 0.5);
const percentile = (values, rank) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * rank) - 1];
const rounded = (n) => Number(n.toFixed(2));
const explainCounts = (plan) => {
  const cursor = plan.stages?.find((stage) => stage.$cursor)?.$cursor || plan;
  const stats = cursor.executionStats;
  const winningPlan = JSON.stringify(cursor.queryPlanner?.winningPlan);
  return {
    indexScan: winningPlan.includes("IXSCAN"),
    collectionScan: winningPlan.includes("COLLSCAN"),
    examined: stats.totalDocsExamined,
    returned: stats.nReturned,
  };
};

const seed = async ({ client, freelancer, count }) => {
  await User.insertMany([
    { _id: client, email: `dashboard-${client}@example.invalid`, password: "synthetic-no-login", role: "client" },
    { _id: freelancer, email: `dashboard-${freelancer}@example.invalid`, password: "synthetic-no-login", role: "freelancer", freelancer_profile: { performanceScore: 80 } },
  ]);
  const clock = Date.now() - 86400000 * 10;
  for (let start = 0; start < count; start += 500) {
    const rows = Array.from({ length: Math.min(500, count - start) }, (_, offset) => {
      const index = start + offset;
      return { _id: randomUUID(), client_id: client, freelancer_id: freelancer, status: statuses[index % 4],
        task_details: { title: `Dashboard fixture ${index}`, description: "Synthetic delivery context. ".repeat(64), deadline: new Date(clock + index + 86400000 * 5), budget: 100.25 },
        workflow: { assignedAt: new Date(clock), startedAt: new Date(clock), submittedAt: new Date(clock),
          ...(index % 4 === 0 ? { completedAt: new Date(clock + 86400000 * 2) } : {}) },
        metrics: { revisionsUsed: index % 8 === 0 ? 1 : 0 },
        updated_at: new Date(clock + index),
      };
    }).map((row) => ({ ...row, task_id: `FD-${row._id}` }));
    await Task.insertMany(rows);
    await Payment.insertMany(rows.map((row, offset) => ({
      payment_id: `FD-${row._id}`, task_id: row._id, client_id: client, freelancer_id: freelancer,
      amounts: { taskBudget: 100.25, freelancerPayout: 85.125 }, status: (start + offset) % 2 ? "escrowed" : "released",
    })));
    await Submission.insertMany(rows.map((row, offset) => ({
      task_id: row._id, freelancer_id: freelancer, submission_type: "initial",
      content: { notes: "Synthetic submission context. ".repeat(48) },
      qa_review: { status: (start + offset) % 2 ? "approved" : "pending" },
    })));
    await Review.insertMany(rows.map((row) => ({
      task_id: row._id, reviewer_id: client, reviewee_id: freelancer, review_type: "platform_to_freelancer", rating: 4,
    })));
  }
};

const clean = ({ client, freelancer }) => Promise.all([
  Task.deleteMany({ client_id: client, freelancer_id: freelancer }),
  Payment.deleteMany({ client_id: client, freelancer_id: freelancer }),
  Review.deleteMany({ reviewer_id: client, reviewee_id: freelancer }),
  Submission.deleteMany({ freelancer_id: freelancer }),
  User.deleteOne({ _id: client }),
  User.deleteOne({ _id: freelancer }),
]);

const assertContract = (role, count, data) => {
  const completed = Math.ceil(count / 4);
  const delivered = Math.floor((count + 2) / 4);
  const inProgress = Math.floor((count + 1) / 4);
  const released = Math.ceil(count / 2);
  const pending = Math.floor(count / 2);
  assert.equal(data.totalTasks, count);
  assert.equal(data.completedTasks, completed);
  assert.equal(data.activeTasks, role === "client" ? delivered + inProgress : inProgress);
  const [listing, state] = role === "client"
    ? [data.recentTasks, data.attentionTasks]
    : [data.currentWork, data.currentWork];
  assert.equal(listing.length, Math.min(5, role === "client" ? count : delivered + inProgress));
  assert.equal(state.length, Math.min(5, delivered + inProgress));
  assert.equal(data.onboarding.role, role);
  if (role === "client") {
    assert.equal(data.totalSpent, released * 100.25);
    assert.equal(data.avgCompletionTime, count ? 2 : 0);
    assert.equal(data.pendingReview, delivered);
  } else {
    assert.equal(data.totalEarnings, released * 85.125);
    assert.equal(data.pendingEarnings, pending * 85.125);
    assert.equal(data.rating, count ? 4 : 0);
    assert.equal(data.totalReviews, count);
    assert.equal(data.onTimeDeliveryRate, 100);
    const firstTimeRate = count ? Math.round(100 * (completed - Math.ceil(count / 8)) / completed) : 100;
    const qaRate = count ? Math.round(100 * pending / count) : 100;
    assert.equal(data.performanceScore, count ? Math.round(56 + firstTimeRate * 0.3 + qaRate * 0.1) : 100);
  }
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: databaseName(), monitorCommands: true, maxPoolSize: 20, serverSelectionTimeoutMS: 5000 });
  const mongo = mongoose.connection.getClient();
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  let current = null;
  mongo.on("commandSucceeded", (event) => {
    if (!current || !["find", "aggregate", "getMore", "update"].includes(event.commandName)) return;
    current.commands++;
    current.mongoDocs += (event.reply.cursor?.firstBatch || event.reply.cursor?.nextBatch || []).length;
  });
  const client = randomUUID();
  const freelancer = randomUUID();
  const fixture = { client, freelancer };
  try {
    await Promise.all([User.init(), Task.init(), Payment.init(), Review.init(), Submission.init()]);
    for (const count of datasetSizes) {
      await seed({ ...fixture, count });
      try {
        for (const role of ["client", "freelancer"]) {
          const id = fixture[role];
          const token = generateAccessToken(id, role);
          const request = async () => {
            current = { commands: 0, mongoDocs: 0 };
            const start = performance.now();
            const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${role}/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
            assert.equal(response.status, 200);
            const payload = await response.text();
            const stats = { ...current, ms: performance.now() - start, bytes: Buffer.byteLength(payload) };
            current = null;
            assertContract(role, count, JSON.parse(payload).data);
            return stats;
          };
          await request();
          await request();
          const batch = [];
          for (let sample = 0; sample < samples; sample++) batch.push(await request());
          assert.ok(batch.every((item) => item.commands > 0), "Mongo command monitoring must be enabled");
          process.stdout.write(`${JSON.stringify({
            role, count, samples, concurrency: 1, errors: 0,
            p50Ms: rounded(median(batch.map((item) => item.ms))),
            p95Ms: rounded(percentile(batch.map((item) => item.ms), 0.95)),
            requestsPerSecond: rounded(samples * 1000 / batch.reduce((total, item) => total + item.ms, 0)),
            medianMongoCommands: median(batch.map((item) => item.commands)),
            medianMongoDocs: median(batch.map((item) => item.mongoDocs)),
            responseBytes: median(batch.map((item) => item.bytes)),
            rssMiB: rounded(process.memoryUsage().rss / 1024 / 1024),
          })}\n`);
          if (count === 10000) {
            const owner = { [role === "client" ? "client_id" : "freelancer_id"]: id };
            const taskPlan = await Task.find(owner).select("_id status freelancer_id updated_at workflow task_details.deadline metrics.revisionsUsed").explain("executionStats");
            const paymentPlan = await Payment.aggregate([
              { $match: { ...owner, status: { $in: role === "client" ? ["released"] : ["released", "pending", "escrowed"] } } },
              { $group: { _id: { $eq: ["$status", "released"] }, amount: { $sum: role === "client" ? "$amounts.taskBudget" : "$amounts.freelancerPayout" } } },
            ]).explain("executionStats");
            process.stdout.write(`${JSON.stringify({ role, count, queryPlans: {
              taskFacts: explainCounts(taskPlan), paymentSummary: explainCounts(paymentPlan),
            } })}\n`);
          }
        }
      } finally { await clean(fixture); }
    }
  } finally {
    current = null;
    await new Promise((resolve) => server.close(resolve));
    try { await clean(fixture); } finally { await disconnectDatabase(); }
  }
};
run().catch((error) => { process.stderr.write(`${error.stack}\n`); process.exitCode = 1; });
