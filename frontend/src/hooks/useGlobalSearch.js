import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import { createGlobalSearchCoordinator, emptyGlobalSearchState } from "../utils/globalSearchCoordinator";

export { createGlobalSearchCoordinator } from "../utils/globalSearchCoordinator";

export const useGlobalSearch = (query, enabled = true) => {
  const [state, setState] = useState(emptyGlobalSearchState);
  const coordinatorRef = useRef(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = createGlobalSearchCoordinator({
      request: (value, config) => api.get("/search", { params: { q: value }, signal: config.signal }),
    });
  }

  useEffect(() => {
    const coordinator = coordinatorRef.current;
    const unsubscribe = coordinator.subscribe(setState);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const coordinator = coordinatorRef.current;
    if (enabled) coordinator.setQuery(query);
    else coordinator.reset();
  }, [enabled, query]);

  useEffect(() => () => coordinatorRef.current?.cancel(), []);

  return {
    ...state,
    retry: () => coordinatorRef.current.retry(),
    reset: () => coordinatorRef.current.reset(),
  };
};

export default useGlobalSearch;
