import test from "node:test";
import assert from "node:assert/strict";

import { createLatestRequestGuard } from "../src/utils/latestRequestGuard.js";

const deferred = () => {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

test("a post-mutation refresh supersedes an older focus or SSE response", async () => {
  const guard = createLatestRequestGuard();
  const oldResponse = deferred();
  const newResponse = deferred();
  const committed = [];
  const settle = async (request, generation) => {
    const value = await request.promise;
    if (guard.isCurrent(generation)) committed.push(value);
  };

  const oldGeneration = guard.begin();
  const oldSettlement = settle(oldResponse, oldGeneration);
  guard.invalidate();
  const newGeneration = guard.begin();
  const newSettlement = settle(newResponse, newGeneration);

  newResponse.resolve("persisted read state");
  await newSettlement;
  oldResponse.resolve("stale unread state");
  await oldSettlement;

  assert.deepEqual(committed, ["persisted read state"]);
});

test("invalidating for a mutation prevents an in-flight response from committing", async () => {
  const guard = createLatestRequestGuard();
  const response = deferred();
  const generation = guard.begin();
  let committed = false;
  const settlement = response.promise.then(() => {
    committed = guard.isCurrent(generation);
  });

  guard.invalidate();
  response.resolve();
  await settlement;

  assert.equal(committed, false);
});
