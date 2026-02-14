// backend/src/data/auditLogData.js
const supabase = require('../config/supabase');

const log = async (logData) => {
  const { user_id, action, resource, resource_id, changes, ip_address, user_agent } = logData;

  const { data, error } = await supabase
    .from('audit_logs')
    .insert([
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
    // In a real app, you might want to handle this more gracefully
    // For now, we'll just log it to the console
    console.error('Error logging audit event:', error.message);
  }

  return data;
};

const findAuditLogs = async (filters) => {
    let query = supabase.from('audit_logs').select('*');

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