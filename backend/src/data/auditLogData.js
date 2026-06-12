// backend/src/data/auditLogData.js
const supabase = require("../config/supabase");
const localAuditLogStore = require("./localAuditLogStore");
const { createSupabaseRunner } = require("./supabaseFallbackRunner");

const runQuery = createSupabaseRunner("audit log");

const log = async (logData) => {
  const { user_id, action, resource, resource_id, changes, ip_address, user_agent } =
    logData;

  const payload = {
    user_id,
    action,
    resource,
    resource_id,
    changes,
    ip_address,
    user_agent,
  };

  const data = await runQuery(
    () => supabase.from("audit_logs").insert([payload]).select(),
    "creating audit log",
    {
      fallbackAction: () => localAuditLogStore.log(payload),
    }
  );

  return Array.isArray(data) ? data[0] : data;
};

const findAuditLogs = async (filters) => {
  const queryFactory = () => {
    let query = supabase.from("audit_logs").select("*");

    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            query = query.eq(key, value);
        });
    }

    return query;
  };

  return runQuery(queryFactory, "finding audit logs", {
    fallbackAction: () => localAuditLogStore.findAuditLogs(filters),
  });
};

module.exports = {
  log,
  findAuditLogs,
};
