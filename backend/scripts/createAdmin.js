require("../src/config/loadEnv");

const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
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

const userData = require("../src/data/userData");

const createAdmin = async () => {
  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const existingUser = await userData.findUserByEmail(email);

  if (existingUser) {
    if (existingUser.role !== "admin") {
      throw new Error(
        "That email already belongs to a non-admin account. Refusing to elevate it automatically.",
      );
    }

    console.log(`Admin account already exists: ${email}`);
    return;
  }

  await userData.createUser({
    email,
    password: process.env.ADMIN_PASSWORD,
    role: "admin",
    profile: {
      firstName: process.env.ADMIN_FIRST_NAME || "TaskNexus",
      lastName: process.env.ADMIN_LAST_NAME || "Administrator",
    },
  });

  console.log(`Admin account created: ${email}`);
};

createAdmin().catch((error) => {
  console.error(`Admin provisioning failed: ${error.message}`);
  process.exitCode = 1;
});
