// backend/src/data/auditLogData.js
const supabase = require("../config/supabase");
const logger = require("../utils/logger");
const { isSupabaseNetworkError } = require("../utils/supabaseErrors");

const log = async (logData) => {
  const { user_id, action, resource, resource_id, changes, ip_address, user_agent } =
    logData;

  try {
    const { data, error } = await supabase.from("audit_logs").insert([
      {
        user_id,
        action,
        resource,
        resource_id,
        changes,
        ip_address,
        user_agent,
      },
    ]);

    if (error) {
      logger.warn("Audit log insert failed", {
        action,
        resource,
        message: error.message,
      });
      return null;
    }

    return data;
  } catch (error) {
    if (isSupabaseNetworkError(error)) {
      logger.warn("Audit logging skipped due Supabase connectivity issue", {
        action,
        resource,
        message: error.message,
      });
      return null;
    }

    logger.error("Unexpected audit log failure", {
      action,
      resource,
      message: error.message,
    });
    return null;
  }
};

const findAuditLogs = async (filters) => {
    let query = supabase.from("audit_logs").select("*");

    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
    }

    const { data, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

module.exports = {
  log,
  findAuditLogs,
};
