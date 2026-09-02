const sendSuccess = (res, { status = 200, data = null, meta, message } = {}) => {
  const payload = { success: true, data };
  if (meta !== undefined) payload.meta = meta;
  if (message) payload.message = message;
  return res.status(status).json(payload);
};

const paginationMeta = ({ page, limit, total }) => {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
};

module.exports = { sendSuccess, paginationMeta };
