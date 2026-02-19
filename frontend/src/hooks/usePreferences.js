import { useState, useEffect } from 'react';

const STORAGE_KEY = 'tasknexus_preferences_v2';

const defaultPrefs = {
  compactCards: false,
  showProgressBars: true,
  showAdvancedStats: true,
  showDeadlineRail: true,
  hideFinancials: false,
  focusMode: false,
  taskLayout: 'list',
  taskDensity: 'cozy',
  defaultTaskFilter: 'all',
  defaultTaskSort: 'newest',
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

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const deepMerge = (base, incoming) => {
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

const getByPath = (source, pathParts) => {
  return pathParts.reduce((current, part) => {
    if (!isObject(current) && !Array.isArray(current)) {
      return undefined;
    }
    return current[part];
  }, source);
};

const setByPath = (source, pathParts, value) => {
  const [head, ...tail] = pathParts;
  if (!head) {
    return source;
  }

  if (tail.length === 0) {
    return {
      ...source,
      [head]: value,
    };
  }

  const nextLevel = isObject(source?.[head]) ? source[head] : {};

  return {
    ...source,
    [head]: setByPath(nextLevel, tail, value),
  };
};

export const usePreferences = () => {
  const [preferences, setPreferences] = useState(defaultPrefs);

  useEffect(() => {
    const stored = safeParse(localStorage.getItem(STORAGE_KEY));
    if (stored) {
      setPreferences(deepMerge(defaultPrefs, stored));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const setPreference = (path, value) => {
    const pathParts = Array.isArray(path) ? path : String(path).split('.').filter(Boolean);
    if (pathParts.length === 0) {
      return;
    }

    setPreferences((prev) => setByPath(prev, pathParts, value));
  };

  const togglePreference = (path) => {
    const pathParts = Array.isArray(path) ? path : String(path).split('.').filter(Boolean);
    if (pathParts.length === 0) {
      return;
    }

    setPreferences((prev) => {
      const current = getByPath(prev, pathParts);
      return setByPath(prev, pathParts, !current);
    });
  };

  const resetPreferences = () => {
    setPreferences(defaultPrefs);
  };

  return { preferences, setPreference, togglePreference, resetPreferences };
};

export default usePreferences;
