require("../src/config/loadEnv");

const CONFIRMATION = "--confirm-admin-provision";
const required = [
  "MONGODB_URI",
  "MONGODB_DB_NAME",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "ADMIN_PROVISION_DB_NAME",
];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

if (process.env.ADMIN_PASSWORD.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters long.");
  process.exit(1);
}

if (!process.argv.includes(CONFIRMATION)) {
  console.error(`Explicit admin provisioning confirmation is required: ${CONFIRMATION}`);
  process.exit(1);
}

if (process.env.ADMIN_PROVISION_DB_NAME !== process.env.MONGODB_DB_NAME) {
  console.error("ADMIN_PROVISION_DB_NAME must exactly match MONGODB_DB_NAME.");
  process.exit(1);
}

const userData = require("../src/data/userData");
const auditLogData = require("../src/data/auditLogData");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");

const createAdmin = async () => {
  await connectDatabase();
  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const existingUser = await userData.findUserByEmail(email);

  if (existingUser) {
    if (existingUser.role !== "admin") {
      throw new Error(
        "That email already belongs to a non-admin account. Refusing to elevate it automatically.",
      );
    }

    await auditLogData.log({
      user_id: existingUser.id,
      action: "PLATFORM_ADMIN_PROVISION_RECONCILED",
      resource: "user",
      resource_id: existingUser.id,
      changes: { source: "controlled_cli", created: false },
    });
    console.log(`Admin account confirmed and audited: ${existingUser.id}`);
    return;
  }

  const admin = await userData.createUser({
    email,
    password: process.env.ADMIN_PASSWORD,
    role: "admin",
    profile: {
      firstName: process.env.ADMIN_FIRST_NAME || "TaskNexus",
      lastName: process.env.ADMIN_LAST_NAME || "Administrator",
    },
  });

  await auditLogData.log({
    user_id: admin.id,
    action: "PLATFORM_ADMIN_PROVISIONED",
    resource: "user",
    resource_id: admin.id,
    changes: { source: "controlled_cli" },
  });

  console.log(`Admin account created and audited: ${admin.id}`);
};

createAdmin().catch((error) => {
  console.error(`Admin provisioning failed: ${error.message}`);
  process.exitCode = 1;
}).finally(disconnectDatabase);
