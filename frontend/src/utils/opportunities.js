export const OPPORTUNITY_TYPE_LABELS = { internship: "Internship", entry_level_job: "Entry-level job" };
export const WORK_MODE_LABELS = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
export const APPLICATION_STATUS_LABELS = { interested: "Interested", applied: "Applied", assessment: "Assessment", interview: "Interview", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn" };
export const NATIVE_APPLICATION_STAGE_LABELS = { submitted: "Submitted", reviewing: "Reviewing", shortlisted: "Shortlisted", assessment: "Assessment", interview: "Interview", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn" };
export const NATIVE_APPLICATION_TRANSITIONS = {
  submitted: ["reviewing", "rejected"], reviewing: ["shortlisted", "assessment", "interview", "rejected"],
  shortlisted: ["assessment", "interview", "offer", "rejected"], assessment: ["interview", "offer", "rejected"],
  interview: ["offer", "rejected"], offer: [], rejected: [], withdrawn: [],
};
export const ELIGIBILITY_LABELS = { eligible: "Likely eligible", possibly_eligible: "Review requirements", not_eligible: "Likely not eligible", unknown: "Unable to determine" };
export const apiError = (error, fallback = "The request could not be completed") => error.response?.data?.error?.message || fallback;
export const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "No deadline published";
export const locationLabel = (item) => item?.display || [item?.city, item?.state, item?.country].filter(Boolean).join(", ");
export const compensationLabel = (value) => {
  if (!value?.currency || (value.min_amount == null && value.max_amount == null)) return "Compensation not disclosed";
  const amount = value.min_amount != null && value.max_amount != null ? `${value.min_amount.toLocaleString()} to ${value.max_amount.toLocaleString()}` : (value.min_amount ?? value.max_amount).toLocaleString();
  return `${value.currency} ${amount} / ${value.period}`;
};
