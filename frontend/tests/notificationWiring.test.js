import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const readSource = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

test("the reusable app shell provides notifications for authenticated public routes", () => {
  const source = readSource("../src/components/layout/AppShell.jsx");

  assert.match(source, /export const AppShellFrame[\s\S]*?const frame = <AppShellFrameContent>[\s\S]*?<NotificationProvider>\{frame\}<\/NotificationProvider>/);
  assert.doesNotMatch(source, /export const AuthenticatedAppShell[\s\S]*?<NotificationProvider>/);
});

test("realtime notification events reconcile through the API instead of mutating the bounded cache", () => {
  const source = readSource("../src/context/NotificationContext.jsx");

  assert.match(source, /const onRealtimeEvent[\s\S]*?scheduleRecentRefresh\(\)/);
  assert.doesNotMatch(source, /type:\s*["']receive["']/);
});

test("notification history ignores responses from superseded requests", () => {
  const source = readSource("../src/pages/NotificationsPage.jsx");

  assert.match(source, /historyRequestGuardRef/);
  assert.match(source, /historyRequestGuardRef\.current\.isCurrent\(requestGeneration\)/);
});
