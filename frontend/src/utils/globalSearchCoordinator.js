import { createLatestRequestGuard } from "./latestRequestGuard.js";

export const emptyGlobalSearchState = () => ({ query: "", groups: {}, loading: false, error: null });
const normalizeQuery = (value) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
const isCancellation = (error, signal) => (
  signal?.aborted || error?.name === "AbortError" || error?.code === "ERR_CANCELED"
);

export const createGlobalSearchCoordinator = ({ request, delay = 250, onChange } = {}) => {
  if (typeof request !== "function") throw new TypeError("A search request function is required");
  const guard = createLatestRequestGuard();
  let state = emptyGlobalSearchState();
  let timeoutId = null;
  let controller = null;
  let disposed = false;
  const listeners = new Set(onChange ? [onChange] : []);

  const publish = (nextState) => {
    state = nextState;
    listeners.forEach((listener) => listener(state));
  };
  const cancelPending = () => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = null;
    controller?.abort();
    controller = null;
    guard.invalidate();
  };
  const execute = async (query) => {
    if (disposed) return;
    const generation = guard.begin();
    controller = new AbortController();
    const activeController = controller;
    publish({ query, groups: {}, loading: true, error: null });
    try {
      const response = await request(query, { signal: activeController.signal });
      const data = response?.data?.data ?? response?.data ?? response;
      if (!disposed && guard.isCurrent(generation) && data?.query === query) {
        publish({ query, groups: data.groups || {}, loading: false, error: null });
      }
    } catch (error) {
      if (!disposed && guard.isCurrent(generation) && !isCancellation(error, activeController.signal)) {
        publish({ query, groups: {}, loading: false, error: "Search is temporarily unavailable. Try again." });
      }
    } finally {
      if (controller === activeController) controller = null;
    }
  };
  const schedule = (query) => {
    timeoutId = setTimeout(() => {
      timeoutId = null;
      execute(query);
    }, delay);
  };

  return Object.freeze({
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setQuery: (value) => {
      const query = normalizeQuery(value);
      cancelPending();
      if (query.length < 2) {
        publish({ query, groups: {}, loading: false, error: null });
        return;
      }
      publish({ query, groups: {}, loading: false, error: null });
      schedule(query);
    },
    retry: () => {
      const query = state.query;
      if (query.length < 2) return;
      cancelPending();
      schedule(query);
    },
    reset: () => {
      cancelPending();
      publish(emptyGlobalSearchState());
    },
    cancel: cancelPending,
    dispose: () => {
      disposed = true;
      cancelPending();
      listeners.clear();
    },
  });
};
