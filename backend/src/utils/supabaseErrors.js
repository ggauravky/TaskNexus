const { ERROR_CODES } = require("../config/constants");

const SUPABASE_NO_ROWS_CODE = "PGRST116";
const NETWORK_ERROR_CODES = new Set([
  "ENOTFOUND",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
]);

const getErrorChain = (error, maxDepth = 5) => {
  const chain = [];
  let current = error;
  let depth = 0;

  while (current && depth < maxDepth) {
    chain.push(current);
    current = current.cause;
    depth += 1;
  }

  return chain;
};

const isSupabaseNoRowsError = (error) => error?.code === SUPABASE_NO_ROWS_CODE;

const isSupabaseNetworkError = (error) => {
  if (!error) return false;

  const chain = getErrorChain(error);

  return chain.some((item) => {
    const message = String(item?.message || "").toLowerCase();
    const code = item?.code;

    if (code && NETWORK_ERROR_CODES.has(code)) {
      return true;
    }

    return (
      message.includes("fetch failed") ||
      message.includes("getaddrinfo") ||
      message.includes("network") ||
      message.includes("dns")
    );
  });
};

const getNetworkReason = (error) => {
  const chain = getErrorChain(error);
  const root = chain[chain.length - 1] || error;
  return root?.message || "Unknown network error";
};

const buildSupabaseError = (error, action, options = {}) => {
  if (!error) return null;

  if (options.allowNoRows && isSupabaseNoRowsError(error)) {
    return null;
  }

  if (isSupabaseNetworkError(error)) {
    const message = `Database connection failed while ${action}. Check SUPABASE_URL, SUPABASE_ANON_KEY, and internet/DNS access.`;
    const wrapped = new Error(message, { cause: error });
    wrapped.statusCode = 503;
    wrapped.code = ERROR_CODES.DATABASE_UNAVAILABLE;
    wrapped.details = {
      action,
      reason: getNetworkReason(error),
    };
    return wrapped;
  }

  const wrapped = new Error(error.message || `Database request failed while ${action}.`, {
    cause: error,
  });
  wrapped.statusCode = error.status || 500;
  wrapped.code = ERROR_CODES.INTERNAL_SERVER_ERROR;
  return wrapped;
};

module.exports = {
  buildSupabaseError,
  isSupabaseNoRowsError,
  isSupabaseNetworkError,
};
