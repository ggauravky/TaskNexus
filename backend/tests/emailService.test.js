const mockSendMail = jest.fn();
const mockVerify = jest.fn();

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail, verify: mockVerify })),
}));

const nodemailer = require("nodemailer");
const { validateEnvironment } = require("../src/config/environment");
const emailService = require("../src/services/email/emailService");
const {
  getEmailConfig,
  resetTransporter,
  verifyTransport,
} = require("../src/services/email/transporter");
const { buildWelcomeEmail } = require("../src/services/email/templates/authEmails");

const originalEnv = process.env;
const enabledEmailEnv = {
  EMAIL_ENABLED: "true",
  EMAIL_APP_NAME: "TaskNexus",
  EMAIL_APP_URL: "https://task-nexus-official.vercel.app",
  EMAIL_SUPPORT_URL: "https://task-nexus-official.vercel.app",
  EMAIL_MAX_ATTEMPTS: "3",
  EMAIL_RETRY_BASE_MS: "1",
  BREVO_SMTP_HOST: "smtp-relay.brevo.com",
  BREVO_SMTP_PORT: "587",
  BREVO_SMTP_USER: "smtp-login",
  BREVO_SMTP_PASS: "smtp-password",
  BREVO_SENDER_EMAIL: "verified-sender@example.com",
  BREVO_SENDER_NAME: "TaskNexus",
  BREVO_REPLY_TO_EMAIL: "support@example.com",
  BREVO_REPLY_TO_NAME: "TaskNexus Support",
};

const message = {
  to: { address: "recipient@example.net", name: "Recipient" },
  subject: "TaskNexus update",
  text: "Plain-text fallback",
  html: "<p>TaskNexus update</p>",
  emailType: "test-message",
};

describe("Nodemailer Brevo SMTP email service", () => {
  beforeEach(() => {
    process.env = { ...originalEnv, ...enabledEmailEnv };
    resetTransporter();
    jest.clearAllMocks();
    nodemailer.createTransport.mockImplementation(() => ({
      sendMail: mockSendMail,
      verify: mockVerify,
    }));
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("creates one Brevo SMTP transport using STARTTLS on port 587", async () => {
    mockSendMail.mockResolvedValue({ messageId: "smtp-message-1" });
    await emailService.sendEmail(message);

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: "smtp-login", pass: "smtp-password" },
    });
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: { address: "verified-sender@example.com", name: "TaskNexus" },
      replyTo: { address: "support@example.com", name: "TaskNexus Support" },
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }));
  });

  test("returns a truthful skipped result when email is disabled", async () => {
    process.env.EMAIL_ENABLED = "false";
    await expect(emailService.sendEmail(message)).resolves.toEqual({
      status: "skipped",
      reason: "EMAIL_DISABLED",
      messageIds: [],
    });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test("returns the SMTP message ID after successful delivery", async () => {
    mockSendMail.mockResolvedValue({ messageId: "smtp-message-2" });
    await expect(emailService.sendEmail(message)).resolves.toEqual({
      status: "sent",
      provider: "brevo-smtp",
      messageIds: ["smtp-message-2"],
    });
  });

  test("retries transient failures with a bounded attempt count", async () => {
    mockSendMail
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }))
      .mockRejectedValueOnce(Object.assign(new Error("temporary"), { responseCode: 451 }))
      .mockResolvedValue({ messageId: "smtp-message-3" });

    await expect(emailService.sendEmail(message)).resolves.toMatchObject({ status: "sent" });
    expect(mockSendMail).toHaveBeenCalledTimes(3);
  });

  test("does not retry permanent SMTP rejection and hides provider details", async () => {
    mockSendMail.mockRejectedValue(Object.assign(new Error("550 mailbox unavailable secret-detail"), {
      code: "EENVELOPE",
      responseCode: 550,
    }));

    await expect(emailService.sendEmail(message)).rejects.toMatchObject({
      code: "EMAIL_DELIVERY_FAILED",
      message: "Email delivery was rejected",
    });
    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  test("rejects an invalid recipient before contacting SMTP", async () => {
    await expect(emailService.sendEmail({ ...message, to: "not-an-email" })).rejects.toMatchObject({
      code: "EMAIL_CONFIGURATION_ERROR",
    });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test("verifies SMTP explicitly without sending a message", async () => {
    mockVerify.mockResolvedValue(true);
    await expect(verifyTransport()).resolves.toEqual({
      status: "verified",
      provider: "brevo-smtp",
    });
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test("production validation names missing SMTP fields without exposing values", () => {
    const production = {
      NODE_ENV: "production",
      APP_ENV: "production",
      APP_ORIGIN: "https://task-nexus-official.vercel.app",
      MONGODB_URI: "mongodb+srv://placeholder.invalid/app",
      MONGODB_DB_NAME: "tasknexus_production",
      JWT_ACCESS_SECRET: "a".repeat(48),
      JWT_REFRESH_SECRET: "b".repeat(48),
      UPLOAD_STORAGE_MODE: "gridfs",
      EMAIL_ENABLED: "true",
      BREVO_SMTP_USER: "private-user-value",
    };

    expect(() => validateEnvironment(production)).toThrow(/BREVO_SMTP_HOST is required/);
    expect(() => validateEnvironment(production)).toThrow(/BREVO_SMTP_PASS is required/);
    expect(() => validateEnvironment(production)).not.toThrow(/private-user-value/);
  });

  test("validates SMTP port, email addresses, and HTTPS production URLs", () => {
    const invalid = {
      NODE_ENV: "production",
      APP_ENV: "production",
      APP_ORIGIN: "https://task-nexus-official.vercel.app",
      MONGODB_URI: "mongodb+srv://placeholder.invalid/app",
      MONGODB_DB_NAME: "tasknexus_production",
      JWT_ACCESS_SECRET: "a".repeat(48),
      JWT_REFRESH_SECRET: "b".repeat(48),
      UPLOAD_STORAGE_MODE: "gridfs",
      ...enabledEmailEnv,
      BREVO_SMTP_PORT: "not-a-port",
      BREVO_SENDER_EMAIL: "invalid",
      BREVO_REPLY_TO_EMAIL: "invalid",
      EMAIL_APP_URL: "http://localhost:5173",
    };
    expect(() => validateEnvironment(invalid)).toThrow(/BREVO_SMTP_PORT/);
    expect(() => validateEnvironment(invalid)).toThrow(/BREVO_SENDER_EMAIL/);
    expect(() => validateEnvironment(invalid)).toThrow(/BREVO_REPLY_TO_EMAIL/);
    expect(() => validateEnvironment(invalid)).toThrow(/EMAIL_APP_URL/);
  });

  test("templates contain HTML and text fallbacks and escape user content", () => {
    const template = buildWelcomeEmail({
      email: "person@example.com",
      profile: { firstName: "<script>alert(1)</script>" },
    }, getEmailConfig().appUrl);
    expect(template.text).toContain("https://task-nexus-official.vercel.app/login");
    expect(template.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(template.html).not.toContain("<script>alert(1)</script>");
  });
});
