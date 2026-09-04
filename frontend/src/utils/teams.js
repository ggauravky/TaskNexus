export const TEAM_INTERESTS = [
  ["open_source", "Open source"], ["startups", "Startups"], ["ai_ml", "AI and ML"],
  ["web_platform", "Web platform"], ["mobile", "Mobile"], ["data", "Data"],
  ["devops", "DevOps"], ["design_systems", "Design systems"], ["accessibility", "Accessibility"],
  ["developer_tools", "Developer tools"], ["climate_tech", "Climate tech"], ["education", "Education"],
  ["cybersecurity", "Cybersecurity"], ["hackathons", "Hackathons"], ["saas", "SaaS"],
];

export const interestLabel = (value) => TEAM_INTERESTS.find(([key]) => key === value)?.[1]
  || String(value || "").replaceAll("_", " ");

export const apiError = (error, fallback = "Something went wrong") =>
  error?.response?.data?.error?.message || fallback;

export const initials = (name = "TaskNexus") => name.split(/\s+/).filter(Boolean).slice(0, 2)
  .map((part) => part[0]?.toUpperCase()).join("") || "TN";

export const dashboardFor = (role) => role === "freelancer"
  ? "/freelancer/dashboard" : role === "admin" ? "/admin/dashboard" : "/client/dashboard";
