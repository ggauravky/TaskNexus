const userData = require("../data/userData");
const realtimeHub = require("../services/realtimeHub");
const {
  deepMerge,
  getDefaultBoardState,
  getDefaultPreferences,
  buildPresetCatalog,
  normalizePreferences,
} = require("../utils/preferencesDefaults");

const SETTINGS_KEY = "settings";
const DEFAULT_ACTIVE_PRESET = "balanced";
const DEFAULT_BOARD_KEY_BY_ROLE = {
  client: "client-dashboard",
  freelancer: "freelancer-dashboard",
  admin: "admin-dashboard",
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const getUserSettingsContainer = (user) => {
  const profile = user.profile || {};
  const settings = profile[SETTINGS_KEY] || {};

  return {
    profile,
    settings: clone(settings),
  };
};

const persistSettings = async (user, settings) => {
  const nextProfile = {
    ...(user.profile || {}),
    [SETTINGS_KEY]: settings,
  };

  const updated = await userData.updateUser(user.id, { profile: nextProfile });
  return updated;
};

const buildPreferencesPayload = (user, settings) => {
  const effective = normalizePreferences(user.role, settings.preferences || {});
  const presets = buildPresetCatalog(user.role, settings.presets || []);

  return {
    preferences: effective,
    presets,
    activePresetId: settings.activePresetId || DEFAULT_ACTIVE_PRESET,
    updatedAt: settings.updatedAt || null,
  };
};

const resolveBoardKey = (req) => {
  const queryKey =
    typeof req.query.boardKey === "string" ? req.query.boardKey.trim() : "";
  const bodyKey =
    typeof req.body?.boardKey === "string" ? req.body.boardKey.trim() : "";

  return (
    queryKey ||
    bodyKey ||
    DEFAULT_BOARD_KEY_BY_ROLE[req.user.role] ||
    "default-dashboard"
  );
};

const emitSettingsEvent = (userId, event, payload) => {
  realtimeHub.publishToUser(userId, event, {
    ...payload,
    ts: new Date().toISOString(),
  });
};

exports.getPreferences = async (req, res, next) => {
  try {
    const user = await userData.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { settings } = getUserSettingsContainer(user);
    const payload = buildPreferencesPayload(user, settings);

    res.status(200).json({
      success: true,
      data: payload,
    });
  } catch (error) {
    next(error);
  }
};

exports.updatePreferences = async (req, res, next) => {
  try {
    const incoming = req.body?.preferences || req.body || {};
    const user = await userData.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { settings } = getUserSettingsContainer(user);
    const nextPreferences = normalizePreferences(
      user.role,
      deepMerge(settings.preferences || {}, incoming),
    );

    settings.preferences = nextPreferences;
    settings.activePresetId = "custom";
    settings.updatedAt = new Date().toISOString();

    await persistSettings(user, settings);
    emitSettingsEvent(req.user.id, "settings.preferences.updated", {
      preferences: nextPreferences,
    });

    res.status(200).json({
      success: true,
      message: "Preferences saved",
      data: buildPreferencesPayload(user, settings),
    });
  } catch (error) {
    next(error);
  }
};

exports.resetPreferences = async (req, res, next) => {
  try {
    const user = await userData.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { settings } = getUserSettingsContainer(user);
    settings.preferences = getDefaultPreferences(user.role);
    settings.activePresetId = DEFAULT_ACTIVE_PRESET;
    settings.updatedAt = new Date().toISOString();

    await persistSettings(user, settings);
    emitSettingsEvent(req.user.id, "settings.preferences.reset", {
      preferences: settings.preferences,
    });

    res.status(200).json({
      success: true,
      message: "Preferences reset to defaults",
      data: buildPreferencesPayload(user, settings),
    });
  } catch (error) {
    next(error);
  }
};

exports.getPresets = async (req, res, next) => {
  try {
    const user = await userData.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { settings } = getUserSettingsContainer(user);
    res.status(200).json({
      success: true,
      data: {
        presets: buildPresetCatalog(user.role, settings.presets || []),
        activePresetId: settings.activePresetId || DEFAULT_ACTIVE_PRESET,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.applyPreset = async (req, res, next) => {
  try {
    const { presetId } = req.body || {};
    if (!presetId) {
      return res
        .status(400)
        .json({ success: false, message: "presetId is required" });
    }

    const user = await userData.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { settings } = getUserSettingsContainer(user);
    const presets = buildPresetCatalog(user.role, settings.presets || []);
    const preset = presets.find((item) => item.id === presetId);

    if (!preset) {
      return res
        .status(404)
        .json({ success: false, message: "Preset not found" });
    }

    settings.preferences = normalizePreferences(user.role, preset.preferences);
    settings.activePresetId = preset.id;
    settings.updatedAt = new Date().toISOString();

    await persistSettings(user, settings);
    emitSettingsEvent(req.user.id, "settings.preset.applied", {
      presetId: preset.id,
      preferences: settings.preferences,
    });

    res.status(200).json({
      success: true,
      message: "Preset applied",
      data: buildPreferencesPayload(user, settings),
    });
  } catch (error) {
    next(error);
  }
};

exports.savePreset = async (req, res, next) => {
  try {
    const { name, description, preferences } = req.body || {};
    const safeName = String(name || "").trim();

    if (!safeName) {
      return res
        .status(400)
        .json({ success: false, message: "Preset name is required" });
    }

    const user = await userData.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { settings } = getUserSettingsContainer(user);
    const customPreset = {
      id: `custom-${Date.now()}`,
      name: safeName.slice(0, 40),
      description: String(description || "").slice(0, 160),
      createdAt: new Date().toISOString(),
      preferences: normalizePreferences(
        user.role,
        preferences || settings.preferences || {},
      ),
    };

    const existing = Array.isArray(settings.presets) ? settings.presets : [];
    settings.presets = [customPreset, ...existing].slice(0, 20);
    settings.activePresetId = customPreset.id;
    settings.preferences = customPreset.preferences;
    settings.updatedAt = new Date().toISOString();

    await persistSettings(user, settings);
    emitSettingsEvent(req.user.id, "settings.preset.saved", {
      presetId: customPreset.id,
    });

    res.status(201).json({
      success: true,
      message: "Preset saved",
      data: {
        preset: customPreset,
        presets: buildPresetCatalog(user.role, settings.presets),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getBoardState = async (req, res, next) => {
  try {
    const boardKey = resolveBoardKey(req);
    const user = await userData.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { settings } = getUserSettingsContainer(user);
    const boardState =
      settings.boards?.[boardKey] ||
      getDefaultBoardState(user.role, boardKey);

    res.status(200).json({
      success: true,
      data: {
        boardKey,
        boardState,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateBoardState = async (req, res, next) => {
  try {
    const boardKey = resolveBoardKey(req);
    const payload = req.body?.boardState || req.body || {};
    const user = await userData.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { settings } = getUserSettingsContainer(user);
    const current =
      settings.boards?.[boardKey] ||
      getDefaultBoardState(user.role, boardKey);

    const nextBoard = deepMerge(current, payload);
    nextBoard.boardKey = boardKey;
    nextBoard.updatedAt = new Date().toISOString();

    settings.boards = settings.boards || {};
    settings.boards[boardKey] = nextBoard;
    settings.updatedAt = new Date().toISOString();

    await persistSettings(user, settings);
    emitSettingsEvent(req.user.id, "settings.board.updated", {
      boardKey,
      boardState: nextBoard,
    });

    res.status(200).json({
      success: true,
      message: "Board state saved",
      data: {
        boardKey,
        boardState: nextBoard,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.resetBoardState = async (req, res, next) => {
  try {
    const boardKey = resolveBoardKey(req);
    const user = await userData.findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { settings } = getUserSettingsContainer(user);
    const freshBoard = getDefaultBoardState(user.role, boardKey);
    settings.boards = settings.boards || {};
    settings.boards[boardKey] = freshBoard;
    settings.updatedAt = new Date().toISOString();

    await persistSettings(user, settings);
    emitSettingsEvent(req.user.id, "settings.board.reset", {
      boardKey,
      boardState: freshBoard,
    });

    res.status(200).json({
      success: true,
      message: "Board reset to defaults",
      data: { boardKey, boardState: freshBoard },
    });
  } catch (error) {
    next(error);
  }
};
