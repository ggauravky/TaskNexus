import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { api } from "../services/api";
import useRealtimeEvents from "../hooks/useRealtimeEvents";
import { createLatestRequestGuard } from "../utils/latestRequestGuard";
import { apiError } from "../utils/marketplace";
import {
  INITIAL_NOTIFICATION_STATE,
  notificationReducer,
  RECENT_NOTIFICATION_LIMIT,
} from "../utils/notificationState";

const NotificationContext = createContext(null);
const NOTIFICATION_EVENTS = ["notification.created"];
const REALTIME_REFRESH_DELAY_MS = 100;

export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, INITIAL_NOTIFICATION_STATE);
  const mountedRef = useRef(true);
  const previousConnectionRef = useRef("connecting");
  const realtimeRefreshTimerRef = useRef(null);
  const refreshGuardRef = useRef(null);
  if (!refreshGuardRef.current) refreshGuardRef.current = createLatestRequestGuard();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      refreshGuardRef.current.invalidate();
      if (realtimeRefreshTimerRef.current) {
        clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
    };
  }, []);

  const refreshRecent = useCallback(async ({ silent = false } = {}) => {
    const requestGeneration = refreshGuardRef.current.begin();
    if (!silent) dispatch({ type: "load_start" });
    try {
      const response = await api.get("/notifications", {
        params: { page: 1, limit: RECENT_NOTIFICATION_LIMIT },
      });
      const data = response.data?.data || {};
      if (mountedRef.current && refreshGuardRef.current.isCurrent(requestGeneration)) {
        dispatch({
          type: "load_success",
          notifications: data.notifications || [],
          unreadCount: data.unreadCount || 0,
        });
      }
      return refreshGuardRef.current.isCurrent(requestGeneration) ? data : null;
    } catch (error) {
      const message = apiError(error, "Notifications could not be loaded");
      if (mountedRef.current && refreshGuardRef.current.isCurrent(requestGeneration)) {
        dispatch({ type: "load_error", error: message });
      }
      return null;
    }
  }, []);

  useEffect(() => {
    refreshRecent();
  }, [refreshRecent]);

  const scheduleRecentRefresh = useCallback(() => {
    if (realtimeRefreshTimerRef.current) clearTimeout(realtimeRefreshTimerRef.current);
    realtimeRefreshTimerRef.current = setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      refreshRecent({ silent: true });
    }, REALTIME_REFRESH_DELAY_MS);
  }, [refreshRecent]);

  const onRealtimeEvent = useCallback((event) => {
    if (event?.type !== "notification.created" || !event.payload?.notification) return;
    scheduleRecentRefresh();
  }, [scheduleRecentRefresh]);

  const { connectionStatus } = useRealtimeEvents(onRealtimeEvent, NOTIFICATION_EVENTS);

  useEffect(() => {
    const previous = previousConnectionRef.current;
    previousConnectionRef.current = connectionStatus;
    if (connectionStatus === "connected" && previous === "reconnecting") {
      refreshRecent({ silent: true });
    }
  }, [connectionStatus, refreshRecent]);

  useEffect(() => {
    const onFocus = () => refreshRecent({ silent: true });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshRecent]);

  const markRead = useCallback(async (notificationOrId) => {
    const id = typeof notificationOrId === "string" ? notificationOrId : notificationOrId?.id;
    if (!id) return null;
    const tracked = state.notifications.find((notification) => notification.id === id);
    if (tracked?.status === "read") return tracked;
    refreshGuardRef.current.invalidate();
    if (tracked) dispatch({ type: "mark_read_optimistic", id });
    try {
      const response = await api.patch(`/notifications/${id}/read`);
      const updated = response.data?.data || { ...tracked, id, status: "read" };
      if (mountedRef.current && tracked) {
        dispatch({ type: "mark_read_commit", id, notification: updated });
      }
      await refreshRecent({ silent: true });
      return updated;
    } catch (error) {
      const message = apiError(error, "Notification could not be opened");
      if (mountedRef.current && tracked) {
        dispatch({ type: "mark_read_rollback", id, error: message });
      }
      throw error;
    }
  }, [refreshRecent, state.notifications]);

  const markAllRead = useCallback(async () => {
    if (state.markAllPending) return false;
    refreshGuardRef.current.invalidate();
    dispatch({ type: "mark_all_optimistic" });
    try {
      await api.patch("/notifications/read-all");
      await refreshRecent({ silent: true });
      if (mountedRef.current) dispatch({ type: "mark_all_commit" });
      return true;
    } catch (error) {
      const message = apiError(error, "Notifications could not be updated");
      if (mountedRef.current) dispatch({ type: "mark_all_rollback", error: message });
      return false;
    }
  }, [refreshRecent, state.markAllPending]);

  const clearError = useCallback(() => dispatch({ type: "clear_error" }), []);

  const value = useMemo(() => ({
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    loading: state.loading,
    error: state.error,
    pendingIds: state.pendingIds,
    markAllPending: state.markAllPending,
    connectionStatus,
    refreshRecent,
    markRead,
    markAllRead,
    clearError,
  }), [clearError, connectionStatus, markAllRead, markRead, refreshRecent, state]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within a NotificationProvider");
  return context;
};

export default NotificationContext;

