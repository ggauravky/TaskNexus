const { getServiceCatalog, findServiceBySlug } = require("../config/serviceCatalog");
const { ERROR_CODES } = require("../config/constants");
const auditLogData = require("../data/auditLogData");
const newsletterData = require("../data/newsletterData");
const serviceBookingData = require("../data/serviceBookingData");
const supportJarData = require("../data/supportJarData");
const logger = require("../utils/logger");
const emailService = require("../services/email/emailService");

const normalizeSettledResult = (settledResult) => {
  if (!settledResult) {
    return { status: "failed", messageIds: [], error: "Unknown email result" };
  }

  if (settledResult.status === "rejected") {
    return {
      status: "failed",
      messageIds: [],
      error: settledResult.reason?.message || "Email delivery failed",
    };
  }

  const value = settledResult.value || {};
  return {
    status: value.status || "failed",
    messageIds: Array.isArray(value.messageIds) ? value.messageIds : [],
    reason: value.reason,
    error: value.error,
  };
};

const summarizeEmailStatus = (results = []) => {
  const statuses = results.map((result) => result.status);

  if (statuses.every((status) => status === "sent")) {
    return "sent";
  }

  if (statuses.every((status) => status === "skipped")) {
    return "skipped";
  }

  if (statuses.includes("sent")) {
    return "partial";
  }

  if (statuses.includes("failed")) {
    return "failed";
  }

  return "partial";
};

const buildMessageIdPayload = (entries) => {
  const payload = {};

  Object.entries(entries).forEach(([key, value]) => {
    if (value.messageIds?.length) {
      payload[key] = value.messageIds;
    }
  });

  return Object.keys(payload).length ? payload : null;
};

const buildContactSyncFailure = (error) => ({
  status: "failed",
  contactId: null,
  error: error?.message || "Contact sync failed",
});

const createReferenceCode = (prefix) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${date}-${random}`;
};

const trim = (value) => String(value || "").trim();

const getServicesCatalog = async (req, res) => {
  res.status(200).json({
    success: true,
    data: getServiceCatalog(),
  });
};

const subscribeNewsletter = async (req, res, next) => {
  try {
    const email = trim(req.body.email).toLowerCase();
    const subscribedAt = new Date().toISOString();

    let subscription = await newsletterData.upsertSubscription({
      email,
      source: "blog",
      status: "subscribed",
      subscribed_at: subscribedAt,
    });

    let contactSyncStatus;
    try {
      contactSyncStatus = await emailService.syncNewsletterContact({ email });
      if (contactSyncStatus.contactId) {
        subscription =
          (await newsletterData.updateSubscriptionByEmail(email, {
            brevo_contact_id: contactSyncStatus.contactId,
            subscribed_at: subscribedAt,
            status: "subscribed",
          })) || subscription;
      }
    } catch (error) {
      logger.warn("Newsletter contact sync failed", {
        email,
        message: error.message,
      });
      contactSyncStatus = buildContactSyncFailure(error);
    }

    const [subscriberEmailResult, adminEmailResult] = await Promise.allSettled([
      emailService.sendNewsletterSubscriberEmail({ email }),
      emailService.sendNewsletterAdminNotification({ email, subscribedAt }),
    ]);

    const emailResults = {
      subscriber: normalizeSettledResult(subscriberEmailResult),
      admin: normalizeSettledResult(adminEmailResult),
    };

    await auditLogData.log({
      action: "NEWSLETTER_SUBSCRIBED",
      resource: "newsletter_subscription",
      resource_id: subscription?.id || null,
      changes: {
        email,
        source: "blog",
        emailStatus: summarizeEmailStatus(Object.values(emailResults)),
        contactSyncStatus: contactSyncStatus?.status || "unknown",
      },
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    res.status(200).json({
      success: true,
      data: {
        subscription,
        contactSyncStatus,
        emailStatus: summarizeEmailStatus(Object.values(emailResults)),
        emailResults,
      },
      message: "Subscribed successfully",
    });
  } catch (error) {
    next(error);
  }
};

const bookService = async (req, res, next) => {
  try {
    const service = findServiceBySlug(req.body.serviceSlug);
    if (!service) {
      return res.status(400).json({
        success: false,
        error: {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: "Unknown service selected",
          details: [
            {
              field: "serviceSlug",
              message: "Choose a valid service option.",
              value: req.body.serviceSlug,
            },
          ],
        },
      });
    }

    const booking = await serviceBookingData.createBooking({
      booking_id: createReferenceCode("BOOK"),
      session_id: createReferenceCode("SESSION"),
      full_name: trim(req.body.fullName),
      email: trim(req.body.email).toLowerCase(),
      phone: trim(req.body.phone) || null,
      service_slug: service.slug,
      service_snapshot: service,
      preferred_date: req.body.preferredDate,
      preferred_time: req.body.preferredTime,
      timezone: trim(req.body.timezone),
      notes: trim(req.body.notes) || null,
      status: "confirmed",
      email_status: "pending",
      brevo_message_ids: null,
    });

    const [customerEmailResult, adminEmailResult] = await Promise.allSettled([
      emailService.sendServiceBookingCustomerConfirmation(booking),
      emailService.sendServiceBookingAdminNotification(booking),
    ]);

    const emailResults = {
      customer: normalizeSettledResult(customerEmailResult),
      admin: normalizeSettledResult(adminEmailResult),
    };
    const emailStatus = summarizeEmailStatus(Object.values(emailResults));
    const brevoMessageIds = buildMessageIdPayload(emailResults);

    const updatedBooking =
      (await serviceBookingData.updateBooking(booking.id, {
        email_status: emailStatus,
        brevo_message_ids: brevoMessageIds,
      })) || {
        ...booking,
        email_status: emailStatus,
        brevo_message_ids: brevoMessageIds,
      };

    await auditLogData.log({
      action: "SERVICE_BOOKING_CREATED",
      resource: "service_booking",
      resource_id: updatedBooking.id,
      changes: {
        serviceSlug: service.slug,
        emailStatus,
        bookingId: updatedBooking.booking_id,
        sessionId: updatedBooking.session_id,
      },
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    res.status(201).json({
      success: true,
      data: {
        booking: updatedBooking,
        emailStatus,
        emailResults,
      },
      message: "Service booking confirmed",
    });
  } catch (error) {
    next(error);
  }
};

const contributeSupportJar = async (req, res, next) => {
  try {
    const contribution = await supportJarData.createContribution({
      full_name: trim(req.body.fullName),
      email: trim(req.body.email).toLowerCase(),
      amount: Number(Number(req.body.amount).toFixed(2)),
      currency: trim(req.body.currency).toUpperCase(),
      message: trim(req.body.message) || null,
      email_status: "pending",
      brevo_message_ids: null,
    });

    const [supporterEmailResult, adminEmailResult] = await Promise.allSettled([
      emailService.sendSupportJarThankYou(contribution),
      emailService.sendSupportJarAdminNotification(contribution),
    ]);

    const emailResults = {
      supporter: normalizeSettledResult(supporterEmailResult),
      admin: normalizeSettledResult(adminEmailResult),
    };
    const emailStatus = summarizeEmailStatus(Object.values(emailResults));
    const brevoMessageIds = buildMessageIdPayload(emailResults);

    const updatedContribution =
      (await supportJarData.updateContribution(contribution.id, {
        email_status: emailStatus,
        brevo_message_ids: brevoMessageIds,
      })) || {
        ...contribution,
        email_status: emailStatus,
        brevo_message_ids: brevoMessageIds,
      };

    await auditLogData.log({
      action: "SUPPORT_JAR_CONTRIBUTION_CREATED",
      resource: "support_jar_contribution",
      resource_id: updatedContribution.id,
      changes: {
        amount: updatedContribution.amount,
        currency: updatedContribution.currency,
        emailStatus,
      },
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    res.status(201).json({
      success: true,
      data: {
        contribution: updatedContribution,
        emailStatus,
        emailResults,
      },
      message: "Support contribution recorded",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  bookService,
  contributeSupportJar,
  getServicesCatalog,
  subscribeNewsletter,
};
