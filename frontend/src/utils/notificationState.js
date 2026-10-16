export const RECENT_NOTIFICATION_LIMIT = 8;

export const formatNotificationBadge = (unreadCount) => {
  const count = boundedCount(unreadCount);
  if (count === 0) return "";
  return count > 99 ? "99+" : String(count);
};

export const notificationBellLabel = (unreadCount) => {
  const count = boundedCount(unreadCount);
  if (count === 0) return "Notifications, no unread items";
  return `Notifications, ${count} unread ${count === 1 ? "item" : "items"}`;
};

export const openNotificationTarget = async (notification, markRead) => {
  if (!notification?.target_path) return null;
  if (notification.status === "read") return notification.target_path;
  try {
    const updated = await markRead(notification);
    return updated ? notification.target_path : null;
  } catch {
    return null;
  }
};

export const INITIAL_NOTIFICATION_STATE = Object.freeze({
  notifications: [],
  unreadCount: 0,
  loading: true,
  error: "",
  pendingIds: [],
  rollbacks: {},
  markAllPending: false,
  markAllRollback: null,
});

const boundedCount = (value) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);

const uniqueRecent = (notifications) => {
  const seen = new Set();
  return (Array.isArray(notifications) ? notifications : []).filter((notification) => {
    if (!notification?.id || seen.has(notification.id)) return false;
    seen.add(notification.id);
    return true;
  }).slice(0, RECENT_NOTIFICATION_LIMIT);
};

const withoutKey = (object, key) => Object.fromEntries(
  Object.entries(object).filter(([entryKey]) => entryKey !== key),
);

export const notificationReducer = (state, action) => {
  switch (action.type) {
    case "load_start":
      return { ...state, loading: true, error: "" };
    case "load_success":
      return {
        ...state,
        notifications: uniqueRecent(action.notifications),
        unreadCount: boundedCount(action.unreadCount),
        loading: false,
        error: "",
        pendingIds: [],
        rollbacks: {},
        markAllPending: false,
        markAllRollback: null,
      };
    case "load_error":
      return { ...state, loading: false, error: action.error || "Notifications could not be loaded" };
    case "mark_read_optimistic": { // Store the affected row so concurrent authoritative refreshes remain safe.
      const notification = state.notifications.find(({ id }) => id === action.id);
      if (!notification || notification.status !== "unread" || state.pendingIds.includes(action.id)) return state;
      return {
        ...state,
        notifications: state.notifications.map((item) => (
          item.id === action.id ? { ...item, status: "read" } : item
        )),
        unreadCount: Math.max(0, state.unreadCount - 1),
        error: "",
        pendingIds: [...state.pendingIds, action.id],
        rollbacks: {
          ...state.rollbacks,
          [action.id]: { notification, decremented: state.unreadCount > 0 ? 1 : 0 },
        },
      };
    }
    case "mark_read_commit":
      return {
        ...state,
        notifications: state.notifications.map((item) => (
          item.id === action.id ? { ...item, ...(action.notification || {}), status: "read" } : item
        )),
        pendingIds: state.pendingIds.filter((id) => id !== action.id),
        rollbacks: withoutKey(state.rollbacks, action.id),
        error: "",
      };
    case "mark_read_rollback": { // Restore only this row and its one-count effect.
      const rollback = state.rollbacks[action.id];
      if (!rollback) return { ...state, error: action.error || "Notification could not be updated" };
      return {
        ...state,
        notifications: state.notifications.map((item) => (
          item.id === action.id ? rollback.notification : item
        )),
        unreadCount: state.unreadCount + rollback.decremented,
        pendingIds: state.pendingIds.filter((id) => id !== action.id),
        rollbacks: withoutKey(state.rollbacks, action.id),
        error: action.error || "Notification could not be updated",
      };
    }
    case "mark_all_optimistic": {
      if (state.markAllPending || state.unreadCount === 0) return state;
      return {
        ...state,
        notifications: state.notifications.map((notification) => ({ ...notification, status: "read" })),
        unreadCount: 0,
        error: "",
        markAllPending: true,
        markAllRollback: {
          statuses: Object.fromEntries(state.notifications.map(({ id, status }) => [id, status])),
          unreadCount: state.unreadCount,
        },
      };
    }
    case "mark_all_commit":
      return { ...state, markAllPending: false, markAllRollback: null };
    case "mark_all_rollback": {
      const rollback = state.markAllRollback;
      if (!rollback) return { ...state, error: action.error || "Notifications could not be updated" };
      return {
        ...state,
        notifications: state.notifications.map((notification) => (
          rollback.statuses[notification.id]
            ? { ...notification, status: rollback.statuses[notification.id] }
            : notification
        )),
        unreadCount: rollback.unreadCount,
        markAllPending: false,
        markAllRollback: null,
        error: action.error || "Notifications could not be updated",
      };
    }
    case "clear_error":
      return { ...state, error: "" };
    default:
      return state;
  }
};

