import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../services/api";
import { deepMerge } from "./usePreferences";

const SAVE_DEBOUNCE_MS = 700;

const DEFAULT_COLUMNS_BY_ROLE = {
  client: [
    { id: "planning", title: "Planning", visible: true },
    { id: "execution", title: "Execution", visible: true },
    { id: "done", title: "Done", visible: true },
    { id: "other", title: "Other", visible: true },
  ],
  freelancer: [
    { id: "active", title: "Active", visible: true },
    { id: "review", title: "Review", visible: true },
    { id: "done", title: "Done", visible: true },
    { id: "other", title: "Other", visible: true },
  ],
  admin: [
    { id: "incoming", title: "Incoming", visible: true },
    { id: "active", title: "Active", visible: true },
    { id: "qa", title: "QA", visible: true },
    { id: "done", title: "Done", visible: true },
  ],
};

const createDefaultBoardState = (role, boardKey) => {
  const columns = DEFAULT_COLUMNS_BY_ROLE[role] || DEFAULT_COLUMNS_BY_ROLE.client;
  return {
    boardKey,
    view: "board",
    filter: "all",
    sort: "newest",
    columns,
    columnOrder: columns.map((column) => column.id),
    taskOrder: {},
    updatedAt: null,
  };
};

const moveInArray = (items, fromIndex, toIndex) => {
  const next = [...items];
  const [picked] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, picked);
  return next;
};

export const useBoardState = ({ boardKey, role, enabled = true }) => {
  const [boardState, setBoardState] = useState(() =>
    createDefaultBoardState(role, boardKey),
  );
  const [loadingBoard, setLoadingBoard] = useState(true);
  const [savingBoard, setSavingBoard] = useState(false);
  const [boardError, setBoardError] = useState(null);

  const skipPersistRef = useRef(false);
  const dirtyRef = useRef(false);
  const initializedRef = useRef(false);

  const fetchBoardState = useCallback(async () => {
    if (!enabled) {
      setLoadingBoard(false);
      return;
    }

    try {
      const response = await api.get("/settings/board", {
        params: { boardKey },
      });
      const payload = response.data?.data?.boardState;
      skipPersistRef.current = true;
      setBoardState(
        deepMerge(createDefaultBoardState(role, boardKey), payload || {}),
      );
      setBoardError(null);
    } catch (error) {
      setBoardError(error?.response?.data?.message || "Board sync unavailable");
    } finally {
      setLoadingBoard(false);
      initializedRef.current = true;
    }
  }, [boardKey, enabled, role]);

  useEffect(() => {
    fetchBoardState();
  }, [fetchBoardState]);

  const persistBoardState = useCallback(async (nextState) => {
    if (!enabled) return;

    setSavingBoard(true);
    try {
      await api.put("/settings/board", {
        boardKey,
        boardState: nextState,
      });
      setBoardError(null);
    } catch (error) {
      setBoardError(error?.response?.data?.message || "Failed to save board state");
    } finally {
      setSavingBoard(false);
    }
  }, [boardKey, enabled]);

  useEffect(() => {
    if (!initializedRef.current) {
      return undefined;
    }

    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return undefined;
    }

    if (!dirtyRef.current) {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      dirtyRef.current = false;
      await persistBoardState(boardState);
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [boardState, persistBoardState]);

  const updateBoardState = useCallback((patch) => {
    dirtyRef.current = true;
    setBoardState((prev) => {
      const next = deepMerge(prev, patch || {});
      next.updatedAt = new Date().toISOString();
      return next;
    });
  }, []);

  const resetBoardState = useCallback(async () => {
    try {
      setSavingBoard(true);
      const response = await api.post("/settings/board/reset", { boardKey });
      const payload = response.data?.data?.boardState;
      skipPersistRef.current = true;
      dirtyRef.current = false;
      setBoardState(
        deepMerge(createDefaultBoardState(role, boardKey), payload || {}),
      );
      setBoardError(null);
    } catch (error) {
      setBoardError(error?.response?.data?.message || "Failed to reset board");
    } finally {
      setSavingBoard(false);
    }
  }, [boardKey, role]);

  const reorderColumns = useCallback((fromIndex, toIndex) => {
    setBoardState((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.columnOrder.length ||
        toIndex >= prev.columnOrder.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }

      dirtyRef.current = true;
      return {
        ...prev,
        columnOrder: moveInArray(prev.columnOrder, fromIndex, toIndex),
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const moveTask = useCallback((taskId, fromColumnId, toColumnId, insertAt = 0) => {
    if (!taskId || !toColumnId) return;

    setBoardState((prev) => {
      const nextTaskOrder = { ...(prev.taskOrder || {}) };
      const destination = [...(nextTaskOrder[toColumnId] || [])];

      Object.keys(nextTaskOrder).forEach((columnId) => {
        nextTaskOrder[columnId] = (nextTaskOrder[columnId] || []).filter(
          (id) => id !== taskId,
        );
      });

      const boundedIndex = Math.max(0, Math.min(insertAt, destination.length));
      destination.splice(boundedIndex, 0, taskId);
      nextTaskOrder[toColumnId] = destination;

      if (fromColumnId && !nextTaskOrder[fromColumnId]) {
        nextTaskOrder[fromColumnId] = [];
      }

      dirtyRef.current = true;
      return {
        ...prev,
        taskOrder: nextTaskOrder,
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const setTaskOrderForColumn = useCallback((columnId, taskIds) => {
    if (!columnId) return;
    setBoardState((prev) => {
      dirtyRef.current = true;
      return {
        ...prev,
        taskOrder: {
          ...(prev.taskOrder || {}),
          [columnId]: Array.isArray(taskIds) ? taskIds : [],
        },
        updatedAt: new Date().toISOString(),
      };
    });
  }, []);

  const orderedColumns = useMemo(() => {
    const byId = new Map(
      (boardState.columns || []).map((column) => [column.id, column]),
    );
    return (boardState.columnOrder || [])
      .map((id) => byId.get(id))
      .filter(Boolean)
      .filter((column) => column.visible !== false);
  }, [boardState.columns, boardState.columnOrder]);

  const sortTasksByColumnOrder = useCallback((columnId, tasks) => {
    const list = Array.isArray(tasks) ? tasks : [];
    const preferred = boardState.taskOrder?.[columnId] || [];
    if (preferred.length === 0) return list;

    const indexMap = new Map(preferred.map((taskId, index) => [taskId, index]));
    return [...list].sort((left, right) => {
      const leftId = left?.id || left?._id;
      const rightId = right?.id || right?._id;
      const leftOrder = indexMap.has(leftId) ? indexMap.get(leftId) : Number.MAX_SAFE_INTEGER;
      const rightOrder = indexMap.has(rightId) ? indexMap.get(rightId) : Number.MAX_SAFE_INTEGER;
      if (leftOrder === rightOrder) return 0;
      return leftOrder - rightOrder;
    });
  }, [boardState.taskOrder]);

  return {
    boardState,
    orderedColumns,
    loadingBoard,
    savingBoard,
    boardError,
    updateBoardState,
    resetBoardState,
    reorderColumns,
    moveTask,
    setTaskOrderForColumn,
    sortTasksByColumnOrder,
    refetchBoardState: fetchBoardState,
  };
};

export default useBoardState;
