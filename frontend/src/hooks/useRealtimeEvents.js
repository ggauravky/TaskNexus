import { useEffect, useMemo, useRef, useState } from "react";
import { API_URL, LOCAL_STORAGE_KEYS } from "../utils/constants";

const DEFAULT_EVENTS = [
  "connected",
  "ping",
  "notification.created",
  "task.created",
  "task.updated",
  "task.status_changed",
  "task.progress.updated",
  "task.comment.created",
  "task.subtask.created",
  "task.subtask.updated",
  "task.subtask.deleted",
  "offer.new",
  "offer.updated",
  "review.new",
  "payout.new",
  "settings.preferences.updated",
  "settings.preferences.reset",
  "settings.preset.applied",
  "settings.board.updated",
  "settings.board.reset",
];

const getRealtimeBaseUrl = () => {
  return API_URL.replace(/\/api\/?$/, "");
};

export const useRealtimeEvents = (onEvent, events = DEFAULT_EVENTS) => {
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [lastEvent, setLastEvent] = useState(null);
  const eventSourceRef = useRef(null);
  const callbackRef = useRef(onEvent);

  callbackRef.current = onEvent;

  const subscribedEvents = useMemo(
    () => [...new Set([...(events || []), "message"])],
    [events],
  );

  useEffect(() => {
    const token = localStorage.getItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) {
      setConnectionStatus("disconnected");
      return undefined;
    }

    const base = getRealtimeBaseUrl();
    const streamUrl = `${base}/api/realtime/stream?token=${encodeURIComponent(token)}`;
    const source = new EventSource(streamUrl);
    eventSourceRef.current = source;

    source.onopen = () => {
      setConnectionStatus("connected");
    };

    source.onerror = () => {
      setConnectionStatus("reconnecting");
    };

    const listeners = subscribedEvents.map((eventName) => {
      const handler = (event) => {
        if (eventName === "ping") {
          return;
        }

        let payload = null;
        try {
          payload = event?.data ? JSON.parse(event.data) : null;
        } catch {
          payload = null;
        }

        const normalized = {
          type: event.type || "message",
          payload,
        };

        setLastEvent(normalized);
        if (typeof callbackRef.current === "function") {
          callbackRef.current(normalized);
        }
      };

      source.addEventListener(eventName, handler);
      return { eventName, handler };
    });

    return () => {
      listeners.forEach(({ eventName, handler }) => {
        source.removeEventListener(eventName, handler);
      });
      source.close();
      eventSourceRef.current = null;
      setConnectionStatus("disconnected");
    };
  }, [subscribedEvents]);

  return {
    connectionStatus,
    lastEvent,
  };
};

export default useRealtimeEvents;
