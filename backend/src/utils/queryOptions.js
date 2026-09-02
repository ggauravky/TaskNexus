const clampInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const parseListQuery = (query = {}, options = {}) => {
  const allowedSorts = options.allowedSorts || ["created_at", "updated_at"];
  const defaultSort = options.defaultSort || allowedSorts[0];
  return {
    page: clampInteger(query.page, 1, 1, 100000),
    limit: clampInteger(query.limit, options.defaultLimit || 20, 1, options.maxLimit || 100),
    sortBy: allowedSorts.includes(query.sortBy) ? query.sortBy : defaultSort,
    sortOrder: query.sortOrder === "asc" ? "asc" : "desc",
    search: String(query.search || "").trim().slice(0, 200),
  };
};

module.exports = { parseListQuery };
