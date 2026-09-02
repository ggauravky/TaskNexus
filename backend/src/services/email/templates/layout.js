const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const renderDetailRows = (rows = []) => {
  const filteredRows = rows.filter((row) => row && row.value !== undefined && row.value !== null && row.value !== "");

  if (filteredRows.length === 0) {
    return "";
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:18px;">
      ${filteredRows
        .map(
          (row) => `
            <tr>
              <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc;color:#475569;font-size:13px;font-weight:600;width:38%;">
                ${escapeHtml(row.label)}
              </td>
              <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;background:#ffffff;color:#0f172a;font-size:13px;">
                ${escapeHtml(row.value)}
              </td>
            </tr>`
        )
        .join("")}
    </table>
  `;
};

const renderBulletList = (items = []) => {
  if (!items.length) {
    return "";
  }

  return `
    <ul style="margin:16px 0 0;padding-left:18px;color:#334155;font-size:14px;line-height:1.7;">
      ${items.map((item) => `<li style="margin-bottom:8px;">${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
};

const renderInfoCard = ({ title, body, accent = "#0ea5e9" }) => `
  <div style="margin-top:18px;border:1px solid rgba(14,165,233,0.16);border-left:4px solid ${accent};border-radius:16px;padding:16px 18px;background:#f8fbff;">
    <p style="margin:0 0 8px;color:#0f172a;font-size:15px;font-weight:700;">${escapeHtml(title)}</p>
    <div style="margin:0;color:#475569;font-size:14px;line-height:1.7;">${body}</div>
  </div>
`;

const renderEmailShell = ({
  previewText,
  eyebrow,
  title,
  intro,
  bodyHtml,
  cta,
  footerLines = [],
}) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#eaf1fb;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      ${escapeHtml(previewText || title)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#eaf1fb;padding:24px 0;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:680px;background:#ffffff;border-radius:28px;overflow:hidden;box-shadow:0 24px 60px rgba(15,23,42,0.12);">
            <tr>
              <td style="padding:26px 32px;background:linear-gradient(135deg,#0f172a 0%,#111f49 48%,#0ea5e9 100%);color:#ffffff;">
                <p style="margin:0;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#cbd5e1;">${escapeHtml(eyebrow || "TaskNexus Update")}</p>
                <h1 style="margin:12px 0 0;font-size:30px;line-height:1.15;font-weight:800;color:#ffffff;">${escapeHtml(title)}</h1>
                <p style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#dbeafe;">${escapeHtml(intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 32px;">
                ${bodyHtml}
                ${
                  cta
                    ? `
                      <div style="margin-top:28px;">
                        <a href="${escapeHtml(cta.href)}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:linear-gradient(135deg,#2563eb 0%,#0ea5e9 100%);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">
                          ${escapeHtml(cta.label)}
                        </a>
                      </div>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
                <p style="margin:0 0 8px;color:#0f172a;font-size:13px;font-weight:700;">TaskNexus</p>
                ${footerLines
                  .map(
                    (line) =>
                      `<p style="margin:0 0 6px;color:#64748b;font-size:12px;line-height:1.6;">${escapeHtml(line)}</p>`
                  )
                  .join("")}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

module.exports = {
  escapeHtml,
  renderBulletList,
  renderDetailRows,
  renderEmailShell,
  renderInfoCard,
};
