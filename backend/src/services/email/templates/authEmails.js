const {
  escapeHtml,
  renderBulletList,
  renderEmailShell,
  renderInfoCard,
} = require("./layout");

const getUserName = (user) => {
  const firstName = user?.profile?.firstName || "";
  const lastName = user?.profile?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || user?.email || "there";
};

const buildWelcomeEmail = (user, appUrl) => {
  const name = getUserName(user);

  return {
    subject: "Welcome to TaskNexus",
    text: [
      `Hi ${name},`,
      "",
      "Welcome to TaskNexus.",
      "",
      "You can now log in to manage work, review progress, and keep delivery organized in one place.",
      "",
      `Dashboard: ${appUrl}/login`,
    ].join("\n"),
    html: renderEmailShell({
      previewText: "Welcome to TaskNexus.",
      eyebrow: "First Login",
      title: `Welcome, ${name}`,
      intro:
        "Your workspace is ready. TaskNexus helps you keep delivery clean, visible, and easier to manage.",
      bodyHtml: `
        <p style="margin:0;color:#334155;font-size:15px;line-height:1.8;">
          Thanks for signing in. Your account is active and ready for live task tracking, role-based dashboards, and a cleaner delivery workflow.
        </p>
        ${renderInfoCard({
          title: "What you can do next",
          body: renderBulletList([
            "Review your dashboard and current work state.",
            "Keep client and freelancer activity in one system.",
            "Track delivery progress without chasing updates.",
          ]),
        })}
      `,
      cta: {
        href: `${appUrl}/login`,
        label: "Open TaskNexus",
      },
      footerLines: [
        "This is an automated account email from TaskNexus.",
        "If this login was not you, review your credentials and rotate your password.",
      ],
    }),
  };
};

const buildWelcomeBackEmail = (user, appUrl) => {
  const name = getUserName(user);
  const role = user?.role ? String(user.role).replace(/(^\w|[-_]\w)/g, (match) => match.replace(/[-_]/, "").toUpperCase()) : "User";

  return {
    subject: "Welcome back to TaskNexus",
    text: [
      `Hi ${name},`,
      "",
      "Welcome back to TaskNexus.",
      "",
      `Your ${role.toLowerCase()} workspace is ready when you are.`,
      "",
      `Dashboard: ${appUrl}/login`,
    ].join("\n"),
    html: renderEmailShell({
      previewText: "Welcome back to TaskNexus.",
      eyebrow: "Returning Login",
      title: `Welcome back, ${name}`,
      intro:
        "Your account is active and your dashboard is ready for the next round of work.",
      bodyHtml: `
        <p style="margin:0;color:#334155;font-size:15px;line-height:1.8;">
          You just signed in to TaskNexus. Your ${escapeHtml(role.toLowerCase())} workspace is available for updates, delivery tracking, and next actions.
        </p>
        ${renderInfoCard({
          title: "Quick reminder",
          body: "Use your dashboard to review active work, update priorities, and keep delivery moving without losing context.",
          accent: "#2563eb",
        })}
      `,
      cta: {
        href: `${appUrl}/login`,
        label: "Go to dashboard",
      },
      footerLines: [
        "This is an automated login notice from TaskNexus.",
        "If this sign-in was unexpected, update your password right away.",
      ],
    }),
  };
};

module.exports = {
  buildWelcomeEmail,
  buildWelcomeBackEmail,
};
