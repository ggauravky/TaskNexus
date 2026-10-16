import { Loader2 } from "lucide-react";

const formattedTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const NotificationRow = ({ notification, pending = false, onOpen }) => {
  const unread = notification.status === "unread";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => onOpen(notification)}
      className={`notification-row ${unread ? "is-unread" : ""}`}
      aria-label={`${unread ? "Unread notification" : "Notification"}: ${notification.content?.title || "Update"}`}
    >
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-start justify-between gap-3">
          <span className="truncate text-sm font-medium text-[#f7f8f8]">
            {notification.content?.title || "TaskNexus update"}
          </span>
          <span className="shrink-0 text-[11px] text-[#62666d]">
            {formattedTime(notification.created_at)}
          </span>
        </span>
        {notification.content?.message ? (
          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[#a4a8b0]">
            {notification.content.message}
          </span>
        ) : null}
        {unread ? (
          <span className="mt-2 inline-flex rounded-full border border-[#5e6ad2]/50 bg-[#5e6ad2]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#aeb5ff]">
            Unread
          </span>
        ) : null}
      </span>
      {pending ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[#aeb5ff]" aria-label="Opening notification" /> : null}
    </button>
  );
};

export default NotificationRow;

