jest.mock("../src/config/serviceCatalog", () => ({
  getServiceCatalog: jest.fn(() => []),
  findServiceBySlug: jest.fn(() => ({ slug: "delivery-audit", name: "Delivery Audit" })),
}));
jest.mock("../src/data/auditLogData", () => ({ log: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../src/data/newsletterData", () => ({}));
jest.mock("../src/data/supportJarData", () => ({}));
jest.mock("../src/data/serviceBookingData", () => ({
  createBooking: jest.fn(),
  updateBooking: jest.fn(),
}));
jest.mock("../src/services/email/emailService", () => ({
  sendServiceBookingCustomerConfirmation: jest.fn(),
  sendServiceBookingAdminNotification: jest.fn(),
}));

const serviceBookingData = require("../src/data/serviceBookingData");
const emailService = require("../src/services/email/emailService");
const { bookService } = require("../src/controllers/publicController");

test("service booking remains persisted when SMTP delivery fails", async () => {
  const booking = {
    id: "booking-id",
    booking_id: "BOOK-1",
    session_id: "SESSION-1",
    service_slug: "delivery-audit",
  };
  serviceBookingData.createBooking.mockResolvedValue(booking);
  serviceBookingData.updateBooking.mockImplementation(async (_id, updates) => ({
    ...booking,
    ...updates,
  }));
  emailService.sendServiceBookingCustomerConfirmation.mockRejectedValue(
    Object.assign(new Error("Email provider is temporarily unavailable"), {
      code: "EMAIL_PROVIDER_UNAVAILABLE",
    }),
  );
  emailService.sendServiceBookingAdminNotification.mockRejectedValue(
    Object.assign(new Error("Email provider is temporarily unavailable"), {
      code: "EMAIL_PROVIDER_UNAVAILABLE",
    }),
  );

  const req = {
    body: {
      serviceSlug: "delivery-audit",
      fullName: "Asha Kumar",
      email: "asha@example.com",
      preferredDate: "2026-10-10",
      preferredTime: "10:00",
      timezone: "Asia/Kolkata",
    },
    headers: {},
    ip: "127.0.0.1",
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();

  await bookService(req, res, next);

  expect(serviceBookingData.createBooking).toHaveBeenCalledTimes(1);
  expect(serviceBookingData.updateBooking).toHaveBeenCalledWith("booking-id", {
    email_status: "failed",
    brevo_message_ids: null,
  });
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    success: true,
    data: expect.objectContaining({ emailStatus: "failed" }),
  }));
  expect(next).not.toHaveBeenCalled();
});
