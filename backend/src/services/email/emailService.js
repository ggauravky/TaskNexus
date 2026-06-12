const logger = require("../../utils/logger");
const {
  getAdminNotificationEmail,
  getBrevoClient,
  getNewsletterListId,
  getPublicAppUrl,
  getReplyTo,
  getSender,
  isBrevoConfigured,
} = require("./brevoClient");
const {
  buildWelcomeEmail,
  buildWelcomeBackEmail,
} = require("./templates/authEmails");
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
  NOT_CONFIGURED: "BREVO_NOT_CONFIGURED",
  ADMIN_MISSING: "BREVO_ADMIN_NOTIFICATION_EMAIL_MISSING",
};

const getMessageIds = (response) => {
  if (!response) return [];
  if (Array.isArray(response.messageIds) && response.messageIds.length > 0) {
    return response.messageIds.filter(Boolean);
  }
  return response.messageId ? [response.messageId] : [];
};

const skippedResult = (reason) => ({
  status: "skipped",
  reason,
  messageIds: [],
});

const getRecipientName = (payload = {}) => {
  const name = String(payload.name || "").trim();
  if (name) {
    return name;
  }

  const fullName = String(payload.fullName || "").trim();
  if (fullName) {
    return fullName;
  }

  return undefined;
};

const sendTransactionalEmail = async ({
  to,
  subject,
  htmlContent,
  textContent,
  tags,
  attachment,
}) => {
  if (!isBrevoConfigured()) {
    logger.warn("Skipping transactional email because Brevo is not configured", {
      subject,
      tags,
    });
    return skippedResult(EMAIL_SKIP_REASONS.NOT_CONFIGURED);
  }

  const client = getBrevoClient();
  const response = await client.transactionalEmails.sendTransacEmail({
    sender: getSender(),
    replyTo: getReplyTo(),
    to: [
      {
        email: to.email,
        name: to.name,
      },
    ],
    subject,
    htmlContent,
    textContent,
    tags,
    attachment,
  });

  return {
    status: "sent",
    provider: "brevo",
    messageIds: getMessageIds(response),
  };
};

const sendAdminEmail = async ({ subject, htmlContent, textContent, tags, attachment }) => {
  const adminEmail = getAdminNotificationEmail();
  if (!adminEmail) {
    logger.warn("Skipping admin email because BREVO_ADMIN_NOTIFICATION_EMAIL is missing", {
      subject,
      tags,
    });
    return skippedResult(EMAIL_SKIP_REASONS.ADMIN_MISSING);
  }

  return sendTransactionalEmail({
    to: { email: adminEmail, name: "TaskNexus Admin" },
    subject,
    htmlContent,
    textContent,
    tags,
    attachment,
  });
};

const syncNewsletterContact = async ({ email, firstName, lastName }) => {
  if (!isBrevoConfigured()) {
    logger.warn("Skipping Brevo contact sync because Brevo is not configured", { email });
    return {
      status: "skipped",
      reason: EMAIL_SKIP_REASONS.NOT_CONFIGURED,
      contactId: null,
    };
  }

  const attributes = {};
  if (firstName) attributes.FNAME = firstName;
  if (lastName) attributes.LNAME = lastName;

  const listId = getNewsletterListId();
  const client = getBrevoClient();
  const response = await client.contacts.createContact({
    email,
    attributes: Object.keys(attributes).length ? attributes : undefined,
    listIds: listId ? [listId] : undefined,
    updateEnabled: true,
  });

  return {
    status: "synced",
    contactId: response?.id || null,
  };
};

const sendLoginEmail = async (user, { wasFirstLogin } = {}) => {
  const appUrl = getPublicAppUrl();
  const template = wasFirstLogin
    ? buildWelcomeEmail(user, appUrl)
    : buildWelcomeBackEmail(user, appUrl);

  return sendTransactionalEmail({
    to: {
      email: user.email,
      name: getRecipientName({
        fullName: `${user?.profile?.firstName || ""} ${user?.profile?.lastName || ""}`.trim(),
      }),
    },
    subject: template.subject,
    htmlContent: template.html,
    textContent: template.text,
    tags: [wasFirstLogin ? "auth-welcome" : "auth-welcome-back"],
  });
};

const sendNewsletterSubscriberEmail = async ({ email }) => {
  const appUrl = getPublicAppUrl();
  const template = buildNewsletterThanksEmail({ email, appUrl });

  return sendTransactionalEmail({
    to: { email },
    subject: template.subject,
    htmlContent: template.html,
    textContent: template.text,
    tags: ["newsletter-thanks"],
  });
};

const sendNewsletterAdminNotification = async ({ email, subscribedAt }) => {
  const template = buildNewsletterAdminEmail({ email, subscribedAt });
  return sendAdminEmail({
    subject: template.subject,
    htmlContent: template.html,
    textContent: template.text,
    tags: ["newsletter-admin"],
  });
};

const sendServiceBookingCustomerConfirmation = async (booking) => {
  const appUrl = getPublicAppUrl();
  const template = buildServiceBookingCustomerEmail({ booking, appUrl });
  const pdfBuffer = await generateBookingConfirmationPdf(booking);

  return sendTransactionalEmail({
    to: {
      email: booking.email,
      name: getRecipientName({ fullName: booking.full_name }),
    },
    subject: template.subject,
    htmlContent: template.html,
    textContent: template.text,
    tags: ["service-booking-confirmation"],
    attachment: [
      {
        name: `${booking.booking_id || "tasknexus-booking"}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });
};

const sendServiceBookingAdminNotification = async (booking) => {
  const template = buildServiceBookingAdminEmail({ booking });
  return sendAdminEmail({
    subject: template.subject,
    htmlContent: template.html,
    textContent: template.text,
    tags: ["service-booking-admin"],
  });
};

const sendSupportJarThankYou = async (contribution) => {
  const appUrl = getPublicAppUrl();
  const template = buildSupportJarThankYouEmail({ contribution, appUrl });

  return sendTransactionalEmail({
    to: {
      email: contribution.email,
      name: getRecipientName({ fullName: contribution.full_name }),
    },
    subject: template.subject,
    htmlContent: template.html,
    textContent: template.text,
    tags: ["support-jar-thanks"],
  });
};

const sendSupportJarAdminNotification = async (contribution) => {
  const template = buildSupportJarAdminEmail({ contribution });
  return sendAdminEmail({
    subject: template.subject,
    htmlContent: template.html,
    textContent: template.text,
    tags: ["support-jar-admin"],
  });
};

module.exports = {
  EMAIL_SKIP_REASONS,
  sendLoginEmail,
  sendNewsletterAdminNotification,
  sendNewsletterSubscriberEmail,
  sendServiceBookingAdminNotification,
  sendServiceBookingCustomerConfirmation,
  sendSupportJarAdminNotification,
  sendSupportJarThankYou,
  syncNewsletterContact,
};
