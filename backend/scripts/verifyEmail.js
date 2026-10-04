require("../src/config/loadEnv");
const { validateEnvironment } = require("../src/config/environment");
const {
  getEmailConfig,
  validateEmailConfig,
  verifyTransport,
} = require("../src/services/email/transporter");
const { buildWelcomeEmail } = require("../src/services/email/templates/authEmails");

const connect = process.argv.includes("--connect");

const verifyConfigurationOnly = () => {
  const sample = {
    NODE_ENV: "production",
    APP_ENV: "production",
    APP_ORIGIN: "https://task-nexus-official.vercel.app",
    ALLOWED_ORIGINS: "https://task-nexus-official.vercel.app",
    MONGODB_URI: "mongodb+srv://placeholder.invalid/tasknexus",
    MONGODB_DB_NAME: "tasknexus_production",
    JWT_ACCESS_SECRET: "a".repeat(48),
    JWT_REFRESH_SECRET: "b".repeat(48),
    UPLOAD_STORAGE_MODE: "gridfs",
    GRIDFS_BUCKET_NAME: "tasknexus_attachments_production",
    EMAIL_ENABLED: "true",
    EMAIL_APP_NAME: "TaskNexus",
    EMAIL_APP_URL: "https://task-nexus-official.vercel.app",
    EMAIL_SUPPORT_URL: "https://task-nexus-official.vercel.app",
    BREVO_SMTP_HOST: "smtp-relay.brevo.com",
    BREVO_SMTP_PORT: "587",
    BREVO_SMTP_USER: "placeholder-login",
    BREVO_SMTP_PASS: "placeholder-password",
    BREVO_SENDER_EMAIL: "verified-sender@example.com",
    BREVO_SENDER_NAME: "TaskNexus",
  };

  const runtime = validateEnvironment(sample);
  const config = validateEmailConfig(getEmailConfig(sample));
  const template = buildWelcomeEmail(
    { email: "person@example.com", profile: { firstName: "TaskNexus" } },
    config.appUrl,
  );
  if (!runtime.emailEnabled || config.port !== 587 || config.secure !== false) {
    throw new Error("Email configuration verification failed");
  }
  if (!template.subject || !template.text || !template.html) {
    throw new Error("Email template verification failed");
  }
  process.stdout.write("Email configuration and template verification passed; no SMTP connection or email send occurred.\n");
};

const main = async () => {
  if (!connect) {
    verifyConfigurationOnly();
    return;
  }

  validateEnvironment(process.env);
  const result = await verifyTransport(process.env);
  process.stdout.write(
    result.status === "verified"
      ? "Brevo SMTP connection and authentication verified; no email was sent.\n"
      : "Email delivery is disabled; SMTP verification skipped.\n",
  );
};

main().catch((error) => {
  process.stderr.write(`Email verification failed: ${error.code || "EMAIL_CONFIGURATION_ERROR"}: ${error.message}\n`);
  process.exit(1);
});
