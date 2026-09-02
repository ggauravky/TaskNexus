/**
 * Application Constants
 */

import {
  NOTIFICATION_TYPES,
  TASK_PRIORITY,
  TASK_STATUS,
  TASK_TYPES,
  USER_ROLES,
} from "../contracts/domain";

export { NOTIFICATION_TYPES, TASK_PRIORITY, TASK_STATUS, TASK_TYPES, USER_ROLES };

export const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const TASK_STATUS_LABELS = {
  [TASK_STATUS.SUBMITTED]: "Submitted",
  [TASK_STATUS.UNDER_REVIEW]: "Under Review",
  [TASK_STATUS.ASSIGNED]: "Assigned",
  [TASK_STATUS.IN_PROGRESS]: "In Progress",
  [TASK_STATUS.SUBMITTED_WORK]: "Work Submitted",
  [TASK_STATUS.QA_REVIEW]: "QA Review",
  [TASK_STATUS.REVISION_REQUESTED]: "Revision Requested",
  [TASK_STATUS.DELIVERED]: "Delivered",
  [TASK_STATUS.CLIENT_REVISION]: "Client Revision",
  [TASK_STATUS.COMPLETED]: "Completed",
  [TASK_STATUS.CANCELLED]: "Cancelled",
  [TASK_STATUS.DISPUTED]: "Disputed",
};

export const TASK_STATUS_COLORS = {
  [TASK_STATUS.SUBMITTED]: "badge-info",
  [TASK_STATUS.UNDER_REVIEW]: "badge-info",
  [TASK_STATUS.ASSIGNED]: "badge-info",
  [TASK_STATUS.IN_PROGRESS]: "badge-warning",
  [TASK_STATUS.SUBMITTED_WORK]: "badge-info",
  [TASK_STATUS.QA_REVIEW]: "badge-warning",
  [TASK_STATUS.REVISION_REQUESTED]: "badge-warning",
  [TASK_STATUS.DELIVERED]: "badge-success",
  [TASK_STATUS.CLIENT_REVISION]: "badge-warning",
  [TASK_STATUS.COMPLETED]: "badge-success",
  [TASK_STATUS.CANCELLED]: "badge-danger",
  [TASK_STATUS.DISPUTED]: "badge-danger",
};

export const TASK_TYPE_LABELS = {
  [TASK_TYPES.VIDEO_EDITING]: "Video Editing",
  [TASK_TYPES.WEB_DEVELOPMENT]: "Web Development",
  [TASK_TYPES.MOBILE_DEVELOPMENT]: "Mobile Development",
  [TASK_TYPES.DESIGN]: "Design",
  [TASK_TYPES.WRITING]: "Writing",
  [TASK_TYPES.MARKETING]: "Marketing",
  [TASK_TYPES.DATA_ENTRY]: "Data Entry",
  [TASK_TYPES.OTHER]: "Other",
};

export const TASK_PRIORITY_LABELS = {
  [TASK_PRIORITY.LOW]: "Low",
  [TASK_PRIORITY.MEDIUM]: "Medium",
  [TASK_PRIORITY.HIGH]: "High",
  [TASK_PRIORITY.URGENT]: "Urgent",
};

export const TASK_PRIORITY_COLORS = {
  [TASK_PRIORITY.LOW]: "badge-gray",
  [TASK_PRIORITY.MEDIUM]: "badge-info",
  [TASK_PRIORITY.HIGH]: "badge-warning",
  [TASK_PRIORITY.URGENT]: "badge-danger",
};

export const ROUTES = {
  // Public
  HOME: "/",
  BLOG: "/blog",
  SERVICES: "/services",
  SUPPORT_JAR: "/support-jar",
  LOGIN: "/login",
  REGISTER: "/register",

  // Client
  CLIENT_DASHBOARD: "/client/dashboard",
  CLIENT_TASKS: "/client/tasks",
  CLIENT_CREATE_TASK: "/client/tasks/create",
  CLIENT_TASK_DETAIL: "/client/tasks/:id",
  CLIENT_PAYMENTS: "/client/payments",

  // Freelancer
  FREELANCER_DASHBOARD: "/freelancer/dashboard",
  FREELANCER_TASKS: "/freelancer/tasks",
  FREELANCER_TASK_DETAIL: "/freelancer/tasks/:id",
  FREELANCER_PROFILE: "/freelancer/profile",
  FREELANCER_EARNINGS: "/freelancer/earnings",

  // Admin
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_TASKS: "/admin/tasks",
  ADMIN_TASK_DETAIL: "/admin/tasks/:id",
  ADMIN_USERS: "/admin/users",
  ADMIN_ANALYTICS: "/admin/analytics",
  ADMIN_SETTINGS: "/admin/settings",
};
