import { useState, useEffect } from 'react';

const STORAGE_KEY = 'tasknexus_preferences_v1';

const defaultPrefs = {
  compactCards: false,
  showProgressBars: true,
  notifications: {
    email: true,
    inApp: true,
    dueReminders: true,
    statusUpdates: true,
  },
};

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const usePreferences = () => {
  const [preferences, setPreferences] = useState(defaultPrefs);

  useEffect(() => {
    const stored = safeParse(localStorage.getItem(STORAGE_KEY));
    if (stored) setPreferences({ ...defaultPrefs, ...stored });
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences]);

  const setPreference = (path, value) => {
    setPreferences((prev) => {
      if (path.includes('.')) {
        const [group, key] = path.split('.');
        return {
          ...prev,
          [group]: {
            ...prev[group],
            [key]: value,
          },
        };
      }
      return { ...prev, [path]: value };
    });
  };

  const togglePreference = (path) => {
    setPreferences((prev) => {
      if (path.includes('.')) {
        const [group, key] = path.split('.');
        return {
          ...prev,
          [group]: {
            ...prev[group],
            [key]: !prev[group][key],
          },
        };
      }
      return { ...prev, [path]: !prev[path] };
    });
  };

  return { preferences, setPreference, togglePreference };
};

export default usePreferences;
