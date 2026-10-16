import test from "node:test";
import assert from "node:assert/strict";

import { createGlobalSearchCoordinator } from "../src/utils/globalSearchCoordinator.js";

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test("debounces 250 ms and suppresses searches below two trimmed characters", async () => {
  const calls = [];
  const coordinator = createGlobalSearchCoordinator({ request: async (query) => {
    calls.push(query);
    return { data: { data: { query, groups: {} } } };
  } });
  coordinator.setQuery(" x ");
  await wait(275);
  assert.deepEqual(calls, []);
  coordinator.setQuery(" ab ");
  await wait(225);
  assert.deepEqual(calls, []);
  await wait(50);
  assert.deepEqual(calls, ["ab"]);
  coordinator.dispose();
});

test("aborted and stale responses cannot replace the newest query", async () => {
  const pending = new Map();
  const coordinator = createGlobalSearchCoordinator({ delay: 0, request: (query, config) => {
    const item = deferred();
    pending.set(query, { ...item, signal: config.signal });
    return item.promise;
  } });
  coordinator.setQuery("ab");
  await wait(5);
  coordinator.setQuery("abc");
  await wait(5);
  coordinator.setQuery("abcd");
  await wait(5);
  assert.equal(pending.get("ab").signal.aborted, true);
  assert.equal(pending.get("abc").signal.aborted, true);
  pending.get("abcd").resolve({ data: { data: { query: "abcd", groups: { teams: [{ id: "new" }] } } } });
  await wait(0);
  pending.get("ab").resolve({ data: { data: { query: "ab", groups: { teams: [{ id: "old" }] } } } });
  await wait(0);
  assert.equal(coordinator.getState().query, "abcd");
  assert.deepEqual(coordinator.getState().groups.teams, [{ id: "new" }]);
  assert.equal(coordinator.getState().error, null);
  coordinator.dispose();
});

test("only the current query owns errors, retry works, and reset clears state", async () => {
  let attempts = 0;
  const coordinator = createGlobalSearchCoordinator({ delay: 0, request: async (query) => {
    attempts += 1;
    if (attempts === 1) throw new Error(`failed ${query}`);
    return { data: { data: { query, groups: { teams: [] } } } };
  } });
  coordinator.setQuery("react");
  await wait(5);
  assert.equal(coordinator.getState().error, "Search is temporarily unavailable. Try again.");
  coordinator.retry();
  await wait(5);
  assert.equal(attempts, 2);
  assert.equal(coordinator.getState().error, null);
  coordinator.reset();
  assert.deepEqual(coordinator.getState(), { query: "", groups: {}, loading: false, error: null });
  coordinator.dispose();
});
