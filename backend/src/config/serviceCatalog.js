const SERVICE_CATALOG = [
  {
    slug: "launch-strategy-session",
    name: "Launch Strategy Session",
    shortDescription:
      "A focused planning session to shape scope, priorities, and launch sequencing.",
    fullDescription:
      "We review your current offer, delivery goals, and blockers, then map a practical execution plan with clear next actions for your team.",
    durationLabel: "75-minute session",
    priceLabel: "INR 4,999",
    ctaLabel: "Book strategy session",
    highlights: [
      "Positioning and offer review",
      "Launch checklist and priorities",
      "Execution notes delivered after the call",
    ],
  },
  {
    slug: "delivery-system-audit",
    name: "Delivery System Audit",
    shortDescription:
      "Review your current workflow, bottlenecks, and handoff quality across operations.",
    fullDescription:
      "We inspect your request intake, communication loops, review gates, and tracking habits, then recommend a cleaner operating rhythm.",
    durationLabel: "90-minute workshop",
    priceLabel: "INR 7,499",
    ctaLabel: "Audit my delivery system",
    highlights: [
      "Workflow and tooling audit",
      "Risk map for delivery gaps",
      "Prioritized improvement roadmap",
    ],
  },
  {
    slug: "ops-automation-blueprint",
    name: "Ops Automation Blueprint",
    shortDescription:
      "Design an automation-ready operating flow for repetitive client or admin work.",
    fullDescription:
      "Ideal for teams with manual follow-up and fragmented tracking. We map automations, approval points, and handoff rules into an implementation-ready blueprint.",
    durationLabel: "60-minute deep dive",
    priceLabel: "INR 5,999",
    ctaLabel: "Plan my automations",
    highlights: [
      "Automation opportunity review",
      "System map with logic notes",
      "Recommended stack and sequence",
    ],
  },
  {
    slug: "fractional-ops-intake",
    name: "Fractional Ops Intake",
    shortDescription:
      "An intake call for teams exploring retained operational support with TaskNexus.",
    fullDescription:
      "We understand your current bandwidth, recurring work, team setup, and growth targets to determine whether a managed support retainer is the right fit.",
    durationLabel: "45-minute consult",
    priceLabel: "Custom quote",
    ctaLabel: "Start retained support intake",
    highlights: [
      "Team and workload assessment",
      "Retainer fit evaluation",
      "Recommended support model",
    ],
  },
];

const getServiceCatalog = () => SERVICE_CATALOG.map((service) => ({ ...service }));

const findServiceBySlug = (slug) =>
  SERVICE_CATALOG.find((service) => service.slug === slug) || null;

module.exports = {
  SERVICE_CATALOG,
  getServiceCatalog,
  findServiceBySlug,
};
