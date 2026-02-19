import { useCallback, useEffect, useRef, useState } from "react";
import api from "../services/api";

const STORAGE_KEY = "tasknexus_preferences_v3";
const SAVE_DEBOUNCE_MS = 700;

export const defaultPrefs = {
  compactCards: false,
  showProgressBars: true,
  showAdvancedStats: true,
  showDeadlineRail: true,
  hideFinancials: false,
  focusMode: false,
  taskLayout: "list",
  taskDensity: "cozy",
  defaultTaskFilter: "all",
  defaultTaskSort: "newest",
  autoRefresh: false,
  autoRefreshSeconds: 120,
  notifications: {
    email: true,
    inApp: true,
    dueReminders: true,
    statusUpdates: true,
  },
  quickActions: {
    templates: true,
    export: true,
    pinning: true,
  },
  goals: {
    weeklyEarnings: 1500,
    weeklyCompletedTasks: 5,
  },
};

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const deepMerge = (base, incoming) => {
  if (!isObject(base) || !isObject(incoming)) {
    return incoming ?? base;
  }

  const merged = { ...base };
  Object.keys(incoming).forEach((key) => {
    const baseValue = base[key];
    const incomingValue = incoming[key];
    if (isObject(baseValue) && isObject(incomingValue)) {
      merged[key] = deepMerge(baseValue, incomingValue);
    } else {
      merged[key] = incomingValue;
    }
  });
  return merged;
};

const getByPath = (source, pathParts) =>
  pathParts.reduce((current, part) => {
    if (!isObject(current) && !Array.isArray(current)) return undefined;
    return current[part];
  }, source);

const setByPath = (source, pathParts, value) => {
  const [head, ...tail] = pathParts;
  if (!head) return source;

  if (tail.length === 0) {
    return {
      ...(source || {}),
      [head]: value,
    };
  }

  const current = isObject(source?.[head]) ? source[head] : {};
  return {
    ...(source || {}),
    [head]: setByPath(current, tail, value),
  };
};

const normalizeIncoming = (incoming) => deepMerge(defaultPrefs, incoming || {});

export const usePreferences = () => {
  const [preferences, setPreferences] = useState(defaultPrefs);
  const [presets, setPresets] = useState([]);
  const [activePresetId, setActivePresetId] = useState("balanced");
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [syncError, setSyncError] = useState(null);

  const dirtyRef = useRef(false);
  const skipPersistRef = useRef(false);
  const initializedRef = useRef(false);

  const hydrateFromServer = useCallback(async () => {
    try {
      const response = await api.get("/settings/preferences");
      const payload = response.data?.data || {};
      skipPersistRef.current = true;
      setPreferences(normalizeIncoming(payload.preferences));
      setPresets(Array.isArray(payload.presets) ? payload.presets : []);
      setActivePresetId(payload.activePresetId || "balanced");
      setSyncError(null);
    } catch (error) {
      setSyncError(
        error?.response?.data?.message || "Cloud sync unavailable. Using local preferences.",
      );
    } finally {
      setLoadingPreferences(false);
      initializedRef.current = true;
    }
  }, []);

  const persistToServer = useCallback(async (nextPreferences) => {
    setSavingPreferences(true);
    try {
      const response = await api.put("/settings/preferences", {
        preferences: nextPreferences,
      });
      const payload = response.data?.data || {};
      setPresets(Array.isArray(payload.presets) ? payload.presets : presets);
      setActivePresetId(payload.activePresetId || "custom");
      setSyncError(null);
    } catch (error) {
      setSyncError(
        error?.response?.data?.message || "Could not save preferences to cloud",
      );
    } finally {
      setSavingPreferences(false);
    }
  }, [presets]);

  useEffect(() => {
    const local = safeParse(localStorage.getItem(STORAGE_KEY));
    if (local) {
      setPreferences(normalizeIncoming(local.preferences || local));
      if (Array.isArray(local.presets)) {
        setPresets(local.presets);
      }
      if (local.activePresetId) {
        setActivePresetId(local.activePresetId);
      }
    }

    hydrateFromServer();
  }, [hydrateFromServer]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        preferences,
        presets,
        activePresetId,
      }),
    );
  }, [preferences, presets, activePresetId]);

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
      await persistToServer(preferences);
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [preferences, persistToServer]);

  const setPreference = useCallback((path, value) => {
    const parts = Array.isArray(path)
      ? path
      : String(path)
          .split(".")
          .filter(Boolean);
    if (parts.length === 0) return;

    dirtyRef.current = true;
    setActivePresetId("custom");
    setPreferences((prev) => normalizeIncoming(setByPath(prev, parts, value)));
  }, []);

  const togglePreference = useCallback((path) => {
    const parts = Array.isArray(path)
      ? path
      : String(path)
          .split(".")
          .filter(Boolean);
    if (parts.length === 0) return;

    dirtyRef.current = true;
    setActivePresetId("custom");
    setPreferences((prev) => {
      const current = getByPath(prev, parts);
      return normalizeIncoming(setByPath(prev, parts, !current));
    });
  }, []);

  const resetPreferences = useCallback(async () => {
    try {
      setSavingPreferences(true);
      const response = await api.post("/settings/preferences/reset");
      const payload = response.data?.data || {};
      skipPersistRef.current = true;
      dirtyRef.current = false;
      setPreferences(normalizeIncoming(payload.preferences));
      setPresets(Array.isArray(payload.presets) ? payload.presets : []);
      setActivePresetId(payload.activePresetId || "balanced");
      setSyncError(null);
    } catch (error) {
      setSyncError(error?.response?.data?.message || "Failed to reset preferences");
    } finally {
      setSavingPreferences(false);
    }
  }, []);

  const applyPreset = useCallback(async (presetId) => {
    if (!presetId) return;
    try {
      setSavingPreferences(true);
      const response = await api.post("/settings/presets/apply", { presetId });
      const payload = response.data?.data || {};
      skipPersistRef.current = true;
      dirtyRef.current = false;
      setPreferences(normalizeIncoming(payload.preferences));
      setPresets(Array.isArray(payload.presets) ? payload.presets : []);
      setActivePresetId(payload.activePresetId || presetId);
      setSyncError(null);
    } catch (error) {
      setSyncError(error?.response?.data?.message || "Failed to apply preset");
    } finally {
      setSavingPreferences(false);
    }
  }, []);

  const savePreset = useCallback(
    async (name, description = "", preferenceSnapshot = preferences) => {
      const safeName = String(name || "").trim();
      if (!safeName) {
        return { success: false, error: "Preset name is required" };
      }

      try {
        setSavingPreferences(true);
        const response = await api.post("/settings/presets", {
          name: safeName,
          description,
          preferences: preferenceSnapshot,
        });
        const payload = response.data?.data || {};
        if (Array.isArray(payload.presets)) {
          setPresets(payload.presets);
        } else {
          const refresh = await api.get("/settings/presets");
          const refreshed = refresh.data?.data || {};
          setPresets(Array.isArray(refreshed.presets) ? refreshed.presets : presets);
        }
        if (payload.preset?.id) {
          setActivePresetId(payload.preset.id);
        }
        setSyncError(null);
        return { success: true, preset: payload.preset || null };
      } catch (error) {
        const message =
          error?.response?.data?.message || "Failed to save preset";
        setSyncError(message);
        return { success: false, error: message };
      } finally {
        setSavingPreferences(false);
      }
    },
    [preferences, presets],
  );

  return {
    preferences,
    presets,
    activePresetId,
    loadingPreferences,
    savingPreferences,
    syncError,
    setPreference,
    togglePreference,
    resetPreferences,
    applyPreset,
    savePreset,
    setPreferences: (value) => {
      dirtyRef.current = true;
      setActivePresetId("custom");
      setPreferences(normalizeIncoming(value));
    },
  };
};

export default usePreferences;
