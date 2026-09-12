export const HACKATHON_STATUS_LABELS = {
  upcoming: "Upcoming", registration_open: "Registration open", active: "Active",
  submission_closed: "Submissions closed", completed: "Completed", archived: "Archived",
};
export const HACKATHON_MODE_LABELS = { online: "Online", offline: "In person", hybrid: "Hybrid" };
export const REQUIREMENT_LABELS = {
  project_title: "Project title", project_description: "Project description", repository: "Repository",
  demo: "Demo", presentation: "Presentation / deck", video: "Video", team_confirmed: "Team confirmed",
  required_form: "Required form completed", submission_url: "Final submission URL",
};
export const formatHackathonDate = (value, options = {}) => value ? new Intl.DateTimeFormat(undefined, options.dateOnly ? {
  year: "numeric", month: "short", day: "numeric",
} : {
  year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
}).format(new Date(value)) : "Not specified";
export const apiError = (error, fallback = "Something went wrong") => error.response?.data?.error?.message || fallback;
