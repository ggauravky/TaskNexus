const logger = require("../../utils/logger");
const {
  getBrevoContactsClient,
  getNewsletterListId,
  isBrevoContactsConfigured,
} = require("./brevoContactsClient");
const {
  EMAIL_PATTERN,
  EmailError,
  getEmailConfig,
  getTransporter,
} = require("./transporter");
const { buildWelcomeEmail, buildWelcomeBackEmail } = require("./templates/authEmails");
const {
  buildNewsletterAdminEmail,
  buildNewsletterThanksEmail,
  buildServiceBookingAdminEmail,
  buildServiceBookingCustomerEmail,
  buildSupportJarAdminEmail,
  buildSupportJarThankYouEmail,
} = require("./templates/publicEmails");
const { generateBookingConfirmationPdf } = require("./pdf/bookingConfirmation");

const EMAIL_SKIP_REASONS = {
  DISABLED: "EMAIL_DISABLED",
  ADMIN_MISSING: "ADMIN_NOTIFICATION_EMAIL_MISSING",
  CONTACTS_NOT_CONFIGURED: "BREVO_CONTACTS_NOT_CONFIGURED",
};

const TRANSIENT_ERROR_CODES = new Set([
  "ECONNECTION",
  "ECONNRESET",
  "ECONNREFUSED",
  "EDNS",
  "ESOCKET",
  "ETIMEDOUT",
]);

const skippedResult = (reason) => ({ status: "skipped", reason, messageIds: [] });
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const recipientAddress = (recipient) => typeof recipient === "string" ? recipient : recipient?.address;
const recipientDomain = (recipient) => {
  const address = recipientAddress(recipient);
  return address?.includes("@") ? address.split("@").pop().toLowerCase() : "invalid";
};
const isTransientEmailError = (error) =>
  TRANSIENT_ERROR_CODES.has(error?.code)
  || (Number(error?.responseCode) >= 400 && Number(error?.responseCode) < 500);

const validateMessage = ({ to, subject, text, html }) => {
  if (!EMAIL_PATTERN.test(String(recipientAddress(to) || "").trim())) {
    throw new EmailError("EMAIL_CONFIGURATION_ERROR", "Email recipient is invalid");
  }
  if (!String(subject || "").trim() || !String(text || "").trim() || !String(html || "").trim()) {
    throw new EmailError(
      "EMAIL_CONFIGURATION_ERROR",
      "Email subject, text, and HTML content are required",
    );
  }
};

const sendEmail = async ({
  to,
  subject,
  text,
  html,
  replyTo,
  attachments,
  emailType = "transactional",
}) => {
  const config = getEmailConfig();
  if (!config.enabled) return skippedResult(EMAIL_SKIP_REASONS.DISABLED);
  validateMessage({ to, subject, text, html });

  const transporter = getTransporter();
  const message = {
    from: config.sender,
    replyTo: replyTo || config.replyTo,
    to,
    subject,
    text,
    html,
    attachments,
    headers: { "X-TaskNexus-Email-Type": String(emailType).slice(0, 80) },
  };

  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    try {
      const info = await transporter.sendMail(message);
      logger.info("Email delivered", {
        provider: "brevo-smtp",
        emailType,
        recipientDomain: recipientDomain(to),
        attempt,
      });
      return {
        status: "sent",
        provider: "brevo-smtp",
        messageIds: info?.messageId ? [info.messageId] : [],
      };
    } catch (error) {
      const transient = isTransientEmailError(error);
      const finalAttempt = attempt === config.maxAttempts;
      logger.warn("Email delivery attempt failed", {
        provider: "brevo-smtp",
        emailType,
        recipientDomain: recipientDomain(to),
        attempt,
        transient,
        errorCode: error?.code || "SMTP_ERROR",
        responseCode: Number(error?.responseCode) || undefined,
      });

      if (!transient || finalAttempt) {
        throw new EmailError(
          transient ? "EMAIL_PROVIDER_UNAVAILABLE" : "EMAIL_DELIVERY_FAILED",
          transient ? "Email provider is temporarily unavailable" : "Email delivery was rejected",
          { cause: error },
        );
      }
      await sleep(config.retryBaseMs * (2 ** (attempt - 1)));
    }
  }

  throw new EmailError("EMAIL_DELIVERY_FAILED", "Email delivery failed");
};

const getRecipientName = (payload = {}) => {
  const name = String(payload.name || payload.fullName || "").trim();
  return name || undefined;
};

const sendTemplate = ({ to, template, emailType, attachments }) => sendEmail({
  to,
  subject: template.subject,
  html: template.html,
  text: template.text,
  emailType,
  attachments,
});

const sendAdminEmail = async ({ template, emailType, attachments }) => {
  const config = getEmailConfig();
  if (!config.enabled) return skippedResult(EMAIL_SKIP_REASONS.DISABLED);
  const adminEmail = config.adminNotificationEmail;
  if (!adminEmail) {
    logger.warn("Skipping admin email because BREVO_ADMIN_NOTIFICATION_EMAIL is missing", {
      emailType,
    });
    return skippedResult(EMAIL_SKIP_REASONS.ADMIN_MISSING);
  }
  return sendTemplate({
    to: { address: adminEmail, name: "TaskNexus Admin" },
    template,
    emailType,
    attachments,
  });
};

const syncNewsletterContact = async ({ email, firstName, lastName }) => {
  if (!isBrevoContactsConfigured()) {
    return {
      status: "skipped",
      reason: EMAIL_SKIP_REASONS.CONTACTS_NOT_CONFIGURED,
      contactId: null,
    };
  }

  const attributes = {};
  if (firstName) attributes.FNAME = firstName;
  if (lastName) attributes.LNAME = lastName;
  const listId = getNewsletterListId();
  const response = await getBrevoContactsClient().contacts.createContact({
    email,
    attributes: Object.keys(attributes).length ? attributes : undefined,
    listIds: listId ? [listId] : undefined,
    updateEnabled: true,
  });
  return { status: "synced", contactId: response?.id || null };
};

const sendLoginEmail = async (user, { wasFirstLogin } = {}) => {
  const appUrl = getEmailConfig().appUrl;
  const template = wasFirstLogin
    ? buildWelcomeEmail(user, appUrl)
    : buildWelcomeBackEmail(user, appUrl);
  return sendTemplate({
    to: {
      address: user.email,
      name: getRecipientName({
        fullName: `${user?.profile?.firstName || ""} ${user?.profile?.lastName || ""}`.trim(),
      }),
    },
    template,
    emailType: wasFirstLogin ? "auth-welcome" : "auth-welcome-back",
  });
};

const sendNewsletterSubscriberEmail = async ({ email }) => sendTemplate({
  to: { address: email },
  template: buildNewsletterThanksEmail({ email, appUrl: getEmailConfig().appUrl }),
  emailType: "newsletter-thanks",
});

const sendNewsletterAdminNotification = async ({ email, subscribedAt }) => sendAdminEmail({
  template: buildNewsletterAdminEmail({ email, subscribedAt }),
  emailType: "newsletter-admin",
});

const sendServiceBookingCustomerConfirmation = async (booking) => {
  if (!getEmailConfig().enabled) return skippedResult(EMAIL_SKIP_REASONS.DISABLED);
  const pdfBuffer = await generateBookingConfirmationPdf(booking);
  return sendTemplate({
    to: { address: booking.email, name: getRecipientName({ fullName: booking.full_name }) },
    template: buildServiceBookingCustomerEmail({ booking, appUrl: getEmailConfig().appUrl }),
    emailType: "service-booking-confirmation",
    attachments: [{
      filename: `${booking.booking_id || "tasknexus-booking"}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    }],
  });
};

const sendServiceBookingAdminNotification = async (booking) => sendAdminEmail({
  template: buildServiceBookingAdminEmail({ booking }),
  emailType: "service-booking-admin",
});

const sendSupportJarThankYou = async (contribution) => sendTemplate({
  to: {
    address: contribution.email,
    name: getRecipientName({ fullName: contribution.full_name }),
  },
  template: buildSupportJarThankYouEmail({ contribution, appUrl: getEmailConfig().appUrl }),
  emailType: "support-jar-thanks",
});

const sendSupportJarAdminNotification = async (contribution) => sendAdminEmail({
  template: buildSupportJarAdminEmail({ contribution }),
  emailType: "support-jar-admin",
});

module.exports = {
  EMAIL_SKIP_REASONS,
  isTransientEmailError,
  sendEmail,
  sendLoginEmail,
  sendNewsletterAdminNotification,
  sendNewsletterSubscriberEmail,
  sendServiceBookingAdminNotification,
  sendServiceBookingCustomerConfirmation,
  sendSupportJarAdminNotification,
  sendSupportJarThankYou,
  syncNewsletterContact,
};
