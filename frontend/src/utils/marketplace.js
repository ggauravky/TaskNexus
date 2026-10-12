export const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(amount || 0));

export const formatDate = (value, fallback = "No date") => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const apiError = (error, fallback = "The request could not be completed") => {
  const payload = error?.response?.data;
  const details = payload?.error?.details;
  if (Array.isArray(details) && details.length) {
    return details.map((item) => item.message || item.msg).filter(Boolean).join(" ") || fallback;
  }
  return payload?.error?.message || payload?.message || error?.message || fallback;
};

export const taskTitle = (task) => task?.task_details?.title || "Untitled task";
export const taskDescription = (task) => task?.task_details?.description || "No description provided";
export const taskBudget = (task) => Number(task?.task_details?.budget || 0);
export const taskDeadline = (task) => task?.task_details?.deadline || null;

export const personName = (person, fallback = "Not assigned") => {
  const name = [person?.profile?.firstName, person?.profile?.lastName].filter(Boolean).join(" ");
  return name || person?.email || fallback;
};

export const dueLabel = (task) => {
  const value = taskDeadline(task);
  if (!value) return { label: "No deadline", urgent: false };
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return { label: "No deadline", urgent: false };
  const days = Math.ceil((time - Date.now()) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, urgent: true };
  if (days === 0) return { label: "Due today", urgent: true };
  if (days === 1) return { label: "Due tomorrow", urgent: true };
  return { label: `Due in ${days}d`, urgent: days <= 3 };
};
