import { useEffect, useRef } from "react";
import { CheckCheck, Loader2, RefreshCw, X } from "lucide-react";
import { Link } from "react-router-dom";
import NotificationRow from "./NotificationRow";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const NotificationPanel = ({
  notifications,
  unreadCount,
  loading,
  error,
  pendingIds,
  markAllPending,
  onOpen,
  onMarkAll,
  onRetry,
  onClose,
}) => {
  const panelRef = useRef(null);

  useEffect(() => {
    const focusable = () => Array.from(panelRef.current?.querySelectorAll(FOCUSABLE) || []);
    focusable()[0]?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <section
      ref={panelRef}
      id="notification-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="notification-panel-title"
      tabIndex={-1}
      className="notification-panel"
    >
      <header className="flex items-start justify-between gap-3 border-b border-[#23252a] p-4">
        <div>
          <h2 id="notification-panel-title" className="text-sm font-semibold text-[#f7f8f8]">Notifications</h2>
          <p className="mt-0.5 text-xs text-[#8a8f98]">{unreadCount ? `${unreadCount} unread` : "You are all caught up"}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="team-icon-button"
            onClick={onMarkAll}
            disabled={!unreadCount || markAllPending}
            aria-label="Mark all notifications as read"
          >
            {markAllPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
          </button>
          <button type="button" className="team-icon-button" onClick={onClose} aria-label="Close notifications">
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {error ? (
        <div role="alert" className="m-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
          <p>{error}</p>
          <button type="button" onClick={onRetry} className="mt-2 inline-flex items-center gap-1 font-semibold text-white underline underline-offset-2">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      ) : null}

      <div className="notification-list" aria-live="polite">
        {loading && !notifications.length ? (
          <div className="flex min-h-40 items-center justify-center text-sm text-[#8a8f98]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading notifications
          </div>
        ) : notifications.length ? notifications.map((notification) => (
          <NotificationRow
            key={notification.id}
            notification={notification}
            pending={pendingIds.includes(notification.id)}
            onOpen={onOpen}
          />
        )) : (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium text-[#d0d6e0]">No notifications yet</p>
            <p className="mt-1 text-xs leading-5 text-[#737780]">Task, team, and application updates will appear here.</p>
          </div>
        )}
      </div>

      <footer className="border-t border-[#23252a] p-3">
        <Link to="/notifications" onClick={onClose} className="team-button-secondary w-full justify-center">
          View all notifications
        </Link>
      </footer>
    </section>
  );
};

export default NotificationPanel;

