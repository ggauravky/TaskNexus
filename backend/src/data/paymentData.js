// backend/src/data/paymentData.js
const supabase = require("../config/supabase");
const logger = require("../utils/logger");
const localPaymentStore = require("./localPaymentStore");
const {
  buildSupabaseError,
  isSupabaseNetworkError,
  isSupabaseNoRowsError,
} = require("../utils/supabaseErrors");

let localFallbackLogged = false;

const isLocalFallbackEnabled = () =>
  process.env.NODE_ENV !== "production" &&
  process.env.DISABLE_LOCAL_AUTH_FALLBACK !== "true";

const logLocalFallbackOnce = () => {
  if (localFallbackLogged) return;
  localFallbackLogged = true;
  logger.warn(
    "Supabase is unreachable. Using local payment fallback store for development."
  );
};

const runQuery = async (queryFactory, action, options = {}) => {
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

const createPayment = async (paymentData) => {
  // Generate unique payment ID: PAY-YYYYMMDD-XXXXXX
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(100000 + Math.random() * 900000);
  const payload = {
    ...paymentData,
    payment_id: paymentData.payment_id || `PAY-${dateStr}-${random}`,
  };

  const data = await runQuery(
    () => supabase.from("payments").insert([payload]).select(),
    "creating payment",
    {
      fallbackAction: () => localPaymentStore.createPayment(payload),
    }
  );

  if (Array.isArray(data)) {
    return data[0];
  }

  return data;
};

const findPayments = async (filters) => {
  const queryFactory = () => {
    let query = supabase.from("payments").select("*");

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          query = query.in(key, value);
          return;
        }
        query = query.eq(key, value);
      });
    }

    return query;
  };

  return runQuery(queryFactory, "finding payments", {
    fallbackAction: () => localPaymentStore.findPayments(filters),
  });
};

const findPaymentById = async (id) => {
  return runQuery(
    () => supabase.from("payments").select("*").eq("id", id).single(),
    "finding payment by id",
    {
      allowNoRows: true,
      fallbackAction: () => localPaymentStore.findPaymentById(id),
    }
  );
};

module.exports = {
  createPayment,
  findPayments,
  findPaymentById,
};
