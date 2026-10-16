import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { WorkspaceHeader, Pagination, SectionCard } from "../components/dashboard/WorkspacePrimitives";
import NotificationRow from "../components/notifications/NotificationRow";
import { useNotifications } from "../context/NotificationContext";
import { api } from "../services/api";
import {
  buildNotificationSearchParams,
  NOTIFICATION_PAGE_SIZE,
  parseNotificationFilters,
  withNotificationFilter,
} from "../utils/notificationFilters";
import { createLatestRequestGuard } from "../utils/latestRequestGuard";
import { apiError } from "../utils/marketplace";
import { openNotificationTarget } from "../utils/notificationState";

const EMPTY_PAGINATION = {
  page: 1,
  limit: NOTIFICATION_PAGE_SIZE,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

const NotificationsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = useMemo(() => parseNotificationFilters(searchParams), [searchParams]);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);
  const historyRequestGuardRef = useRef(null);
  if (!historyRequestGuardRef.current) historyRequestGuardRef.current = createLatestRequestGuard();
  const {
    markRead,
    markAllRead,
    refreshRecent,
  } = useNotifications();

  const load = useCallback(async () => {
    const requestGeneration = historyRequestGuardRef.current.begin();
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/notifications", {
        params: {
          page: filters.page,
          limit: NOTIFICATION_PAGE_SIZE,
          unreadOnly: filters.filter === "unread" ? true : undefined,
        },
      });
      if (!historyRequestGuardRef.current.isCurrent(requestGeneration)) return;
      const data = response.data?.data || {};
      const nextPagination = response.data?.meta?.pagination || EMPTY_PAGINATION;
      const lastPage = Math.max(1, nextPagination.totalPages || 1);
      if (filters.page > lastPage) {
        setSearchParams(buildNotificationSearchParams({ filter: filters.filter, page: lastPage }), { replace: true });
        return;
      }
      setItems(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
      setPagination(nextPagination);
    } catch (requestError) {
      if (!historyRequestGuardRef.current.isCurrent(requestGeneration)) return;
      setError(apiError(requestError, "Notifications could not be loaded"));
    } finally {
      if (historyRequestGuardRef.current.isCurrent(requestGeneration)) setLoading(false);
    }
  }, [filters.filter, filters.page, setSearchParams]);

  useEffect(() => () => {
    historyRequestGuardRef.current.invalidate();
  }, []);

  useEffect(() => {
    const canonical = buildNotificationSearchParams(filters).toString();
    if (searchParams.toString() !== canonical) {
      setSearchParams(canonical, { replace: true });
      return;
    }
    load();
  }, [filters, load, searchParams, setSearchParams]);

  const openRow = async (notification) => {
    if (pendingId) return;
    setPendingId(notification.id);
    setError("");
    const target = await openNotificationTarget(notification, markRead);
    setPendingId("");
    if (!target) {
      setError("Notification could not be opened. Please try again.");
      return;
    }
    navigate(target);
  };

  const markAll = async () => {
    if (!unreadCount || markingAll) return;
    setMarkingAll(true);
    setError("");
    const updated = await markAllRead();
    if (!updated) {
      setError("Notifications could not be updated. Please try again.");
      setMarkingAll(false);
      return;
    }
    await Promise.all([load(), refreshRecent({ silent: true })]);
    setMarkingAll(false);
  };

  const setFilter = (filter) => {
    setSearchParams(withNotificationFilter(searchParams, filter));
  };

  const setPage = (page) => {
    setSearchParams(buildNotificationSearchParams({ filter: filters.filter, page }));
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <WorkspaceHeader
        eyebrow="Notification center"
        title="Stay close to the work that changed."
        description="Task, team, project, and application updates remain persisted here even when realtime delivery is unavailable."
        actions={(
          <>
            <button type="button" onClick={markAll} disabled={!unreadCount || markingAll} className="team-button-secondary">
              {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              Mark all read
            </button>
            <button type="button" onClick={load} disabled={loading} className="team-button-secondary">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
          </>
        )}
      />

      <section className="mt-7 flex flex-wrap items-center justify-between gap-3" aria-label="Notification filters">
        <div className="inline-flex rounded-lg border border-[#34343a] bg-[#0f1011] p-1">
          {[
            ["all", "All"],
            ["unread", "Unread"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filters.filter === value}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${filters.filter === value ? "bg-[#5e6ad2] text-white" : "text-[#8a8f98] hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-[#8a8f98]" aria-live="polite">
          {unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "No unread notifications"}
        </p>
      </section>

      <SectionCard
        className="mt-5"
        title={filters.filter === "unread" ? "Unread notifications" : "Notification history"}
        description={`Showing a bounded page of ${NOTIFICATION_PAGE_SIZE} notifications.`}
      >
        {error ? (
          <div role="alert" className="mb-4 flex flex-col gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button type="button" onClick={load} className="team-button-secondary shrink-0">Try again</button>
          </div>
        ) : null}

        {loading && !items.length ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-[#8a8f98]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading notifications
          </div>
        ) : items.length ? (
          <div className="overflow-hidden rounded-xl border border-[#23252a]">
            {items.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                pending={pendingId === notification.id}
                onOpen={openRow}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#34343a] bg-[#141516] text-[#8a8f98]"><Bell className="h-5 w-5" /></span>
            <p className="mt-4 text-sm font-medium text-[#f7f8f8]">{filters.filter === "unread" ? "No unread notifications" : "No notifications yet"}</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-[#737780]">Updates appear here after real work changes across TaskNexus.</p>
          </div>
        )}

        <Pagination pagination={pagination} onPage={setPage} disabled={loading || Boolean(pendingId)} />
      </SectionCard>
    </main>
  );
};

export default NotificationsPage;

