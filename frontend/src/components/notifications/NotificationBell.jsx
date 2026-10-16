import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../context/NotificationContext";
import {
  formatNotificationBadge,
  notificationBellLabel,
  openNotificationTarget,
} from "../../utils/notificationState";
import NotificationPanel from "./NotificationPanel";

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    pendingIds,
    markAllPending,
    refreshRecent,
    markRead,
    markAllRead,
    clearError,
  } = useNotifications();

  const close = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [close, open]);

  const openRow = async (notification) => {
    clearError();
    const target = await openNotificationTarget(notification, markRead);
    if (!target) return;
    close();
    navigate(target);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        className="notification-bell"
        aria-label={notificationBellLabel(unreadCount)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-panel"
        onClick={() => {
          clearError();
          setOpen((value) => !value);
        }}
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount ? <span className="notification-badge" aria-hidden="true">{formatNotificationBadge(unreadCount)}</span> : null}
      </button>
      {open ? (
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          error={error}
          pendingIds={pendingIds}
          markAllPending={markAllPending}
          onOpen={openRow}
          onMarkAll={markAllRead}
          onRetry={() => refreshRecent()}
          onClose={close}
        />
      ) : null}
    </div>
  );
};

export default NotificationBell;

