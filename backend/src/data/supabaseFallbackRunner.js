const logger = require("../utils/logger");
const {
  buildSupabaseError,
  isSupabaseNetworkError,
  isSupabaseNoRowsError,
} = require("../utils/supabaseErrors");

const isLocalFallbackEnabled = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.DISABLE_LOCAL_AUTH_FALLBACK !== "true";

const createSupabaseRunner = (fallbackLabel) => {
  let localFallbackLogged = false;

  const logLocalFallbackOnce = () => {
    if (localFallbackLogged) return;
    localFallbackLogged = true;
    logger.warn(
      `Supabase is unreachable. Using local ${fallbackLabel} fallback store for development.`
    );
  };

  return async (queryFactory, action, options = {}) => {
    try {
      const { data, error } = await queryFactory();

      if (error) {
        if (options.allowNoRows && isSupabaseNoRowsError(error)) {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      if (isLocalFallbackEnabled() && isSupabaseNetworkError(error)) {
        logLocalFallbackOnce();
        return options.fallbackAction();
      }

      if (options.allowNoRows && isSupabaseNoRowsError(error)) {
        return null;
      }

      throw buildSupabaseError(error, action, {
        allowNoRows: options.allowNoRows,
      });
    }
  };
};

module.exports = {
  createSupabaseRunner,
  isLocalFallbackEnabled,
};
