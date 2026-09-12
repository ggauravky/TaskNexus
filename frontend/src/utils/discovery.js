export const INTEREST_LABELS = {
  open_source: "Open source", startups: "Startups", ai_ml: "AI and ML", web_platform: "Web platform",
  mobile: "Mobile", data: "Data", devops: "DevOps", design_systems: "Design systems",
  accessibility: "Accessibility", developer_tools: "Developer tools", climate_tech: "Climate tech",
  education: "Education", data_science: "Data science", hackathons: "Hackathons", saas: "SaaS",
  cloud: "Cloud", cybersecurity: "Cybersecurity",
};

export const ROLE_LABELS = {
  builder: "Builder", designer: "Designer", product_lead: "Product lead", project_lead: "Project lead",
  reviewer: "Reviewer", mentor: "Mentor", researcher: "Researcher", data_specialist: "Data specialist",
  frontend_developer: "Frontend developer", backend_developer: "Backend developer",
  full_stack_developer: "Full-stack developer", mobile_developer: "Mobile developer", ml_engineer: "ML engineer",
  data_analyst: "Data analyst", ui_ux_designer: "UI/UX designer", devops_engineer: "DevOps",
  qa_engineer: "QA", product: "Product",
};

export const AVAILABILITY_LABELS = { open: "Available", limited: "Limited availability", unavailable: "Not looking" };
export const COMMITMENT_LABELS = { exploring: "Exploring", few_hours: "A few hours weekly", part_time: "Part-time", full_time: "Full-time" };
export const labelFor = (value) => ROLE_LABELS[value] || INTEREST_LABELS[value] || value?.replaceAll("_", " ") || "";
export const apiError = (error, fallback = "Something went wrong") => error.response?.data?.error?.message || fallback;
