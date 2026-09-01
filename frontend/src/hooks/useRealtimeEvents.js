import { useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "../utils/constants";
import { getAccessToken } from "../services/api";

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
  const connectionRef = useRef(null);
  const callbackRef = useRef(onEvent);

  callbackRef.current = onEvent;

  const subscribedEvents = useMemo(
    () => [...new Set([...(events || []), "message"])],
    [events],
  );

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setConnectionStatus("disconnected");
      return undefined;
    }

    let stopped = false;
    const base = getRealtimeBaseUrl();
    const streamUrl = `${base}/api/realtime/stream`;
    const controller = new AbortController();
    connectionRef.current = controller;

    const publishEvent = (eventName, rawData) => {
      if (eventName === "ping" || !subscribedEvents.includes(eventName)) return;

      let payload = null;
      try {
        payload = rawData ? JSON.parse(rawData) : null;
      } catch {
        payload = null;
      }

      const normalized = { type: eventName || "message", payload };
      setLastEvent(normalized);
      if (typeof callbackRef.current === "function") {
        callbackRef.current(normalized);
      }
    };

    const connect = async () => {
      while (!stopped) {
        try {
          const currentToken = getAccessToken();
          if (!currentToken) {
            setConnectionStatus("disconnected");
            return;
          }

          const response = await fetch(streamUrl, {
            method: "GET",
            headers: {
              Accept: "text/event-stream",
              Authorization: `Bearer ${currentToken}`,
            },
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            throw new Error(`Realtime connection failed (${response.status})`);
          }

          setConnectionStatus("connected");
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (!stopped) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const frames = buffer.split(/\r?\n\r?\n/);
            buffer = frames.pop() || "";

            frames.forEach((frame) => {
              let eventName = "message";
              const dataLines = [];
              frame.split(/\r?\n/).forEach((line) => {
                if (line.startsWith("event:")) eventName = line.slice(6).trim();
                if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
              });
              publishEvent(eventName, dataLines.join("\n"));
            });
          }
        } catch (error) {
          if (stopped || error?.name === "AbortError") return;
          setConnectionStatus("reconnecting");
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    };

    connect();

    return () => {
      stopped = true;
      controller.abort();
      connectionRef.current = null;
      setConnectionStatus("disconnected");
    };
  }, [subscribedEvents]);

  return {
    connectionStatus,
    lastEvent,
  };
};

export default useRealtimeEvents;
