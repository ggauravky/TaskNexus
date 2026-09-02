const PDFDocument = require("pdfkit");

const formatDateLabel = (value) => {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatDateTimeLabel = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
};

const drawPair = (doc, label, value) => {
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#475569")
    .text(label.toUpperCase(), { continued: false });

  doc
    .moveDown(0.2)
    .font("Helvetica")
    .fontSize(12)
    .fillColor("#0f172a")
    .text(value || "-");

  doc.moveDown(0.8);
};

const generateBookingConfirmationPdf = (booking) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 52 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc
      .rect(0, 0, doc.page.width, 170)
      .fill("#0f172a");

    doc
      .fillColor("#7dd3fc")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("TASKNEXUS SERVICE REQUEST", 52, 42);

    doc
      .fillColor("#ffffff")
      .fontSize(26)
      .text("Request Summary", 52, 64);

    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#cbd5e1")
      .text(
        "Keep this request summary for your records. It includes the request ID, session reference, preferred timing, and submitted contact details. Availability is confirmed separately.",
        52,
        104,
        { width: 500, lineGap: 2 }
      );

    doc.y = 198;
    drawPair(doc, "Service", booking.service_snapshot?.name || booking.service_slug);
    drawPair(doc, "Request ID", booking.booking_id);
    drawPair(doc, "Session reference", booking.session_id);
    drawPair(doc, "Customer", booking.full_name);
    drawPair(doc, "Email", booking.email);
    drawPair(doc, "Phone", booking.phone || "Not provided");
    drawPair(doc, "Preferred date", formatDateLabel(booking.preferred_date));
    drawPair(doc, "Preferred time", `${booking.preferred_time} (${booking.timezone})`);
    drawPair(doc, "Submitted at", formatDateTimeLabel(booking.created_at));

    if (booking.notes) {
      doc
        .roundedRect(52, doc.y + 4, 490, 90, 14)
        .fillAndStroke("#f8fafc", "#dbeafe");

      doc
        .fillColor("#0f172a")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("Submitted Notes", 68, doc.y - 78);

      doc
        .font("Helvetica")
        .fontSize(11)
        .fillColor("#334155")
        .text(booking.notes, 68, doc.y - 58, { width: 458, lineGap: 3 });

      doc.moveDown(5.5);
    }

    doc
      .moveDown(1)
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#0f172a")
      .text("Need help?");

    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#475569")
      .text(
        "Reply to the request email or contact the TaskNexus team if you need to adjust the submitted service details.",
        { width: 500, lineGap: 3 }
      );

    doc.end();
  });

module.exports = {
  generateBookingConfirmationPdf,
};
