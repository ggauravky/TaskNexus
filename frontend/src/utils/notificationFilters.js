export const NOTIFICATION_PAGE_SIZE = 20;
export const MAX_NOTIFICATION_PAGE = 10000;

export const parseNotificationFilters = (searchParams) => {
  const filterValue = searchParams?.get?.("filter");
  const pageValue = searchParams?.get?.("page") || "1";
  const page = /^\d+$/.test(pageValue) ? Number(pageValue) : 0;
  return {
    filter: filterValue === "unread" ? "unread" : "all",
    page: page >= 1 && page <= MAX_NOTIFICATION_PAGE ? page : 1,
  };
};

export const buildNotificationSearchParams = ({ filter = "all", page = 1 }) => {
  const normalized = parseNotificationFilters(new URLSearchParams({
    filter,
    page: String(page),
  }));
  return new URLSearchParams({
    filter: normalized.filter,
    page: String(normalized.page),
  });
};

export const withNotificationFilter = (_searchParams, filter) => (
  buildNotificationSearchParams({ filter, page: 1 })
);

