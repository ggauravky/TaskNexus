import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNotificationSearchParams,
  parseNotificationFilters,
  withNotificationFilter,
} from "../src/utils/notificationFilters.js";

test("notification filters fall back for invalid filter and page values", () => {
  assert.deepEqual(parseNotificationFilters(new URLSearchParams("filter=other&page=-3")), {
    filter: "all",
    page: 1,
  });
  assert.deepEqual(parseNotificationFilters(new URLSearchParams("filter=unread&page=10001")), {
    filter: "unread",
    page: 1,
  });
  assert.deepEqual(parseNotificationFilters(new URLSearchParams("filter=unread&page=2.5")), {
    filter: "unread",
    page: 1,
  });
});

test("notification query generation is stable", () => {
  assert.equal(buildNotificationSearchParams({ filter: "unread", page: 3 }).toString(), "filter=unread&page=3");
  assert.equal(buildNotificationSearchParams({ filter: "all", page: 1 }).toString(), "filter=all&page=1");
});

test("changing the notification filter resets pagination", () => {
  const next = withNotificationFilter(new URLSearchParams("filter=all&page=8"), "unread");
  assert.equal(next.toString(), "filter=unread&page=1");
});

