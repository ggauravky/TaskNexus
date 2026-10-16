const mockNotificationData = { createNotification: jest.fn() };
const mockRealtimeHub = { publishToUser: jest.fn() };

jest.mock("../src/data/notificationData", () => mockNotificationData);
jest.mock("../src/services/realtimeHub", () => mockRealtimeHub);
jest.mock("../src/utils/logger", () => ({ error: jest.fn() }));

const NotificationService = require("../src/services/notificationService");

const TASK_ID = "00000000-0000-4000-8000-000000000101";

describe("notification realtime DTO", () => {
  beforeEach(() => jest.clearAllMocks());

  test("publishes the canonical serialized notification with a safe target", async () => {
    mockNotificationData.createNotification.mockResolvedValue({
      id: "notification-1",
      recipient_id: "recipient-1",
      actor_id: "actor-1",
      type: "task_progress",
      related_task_id: TASK_ID,
      content: { title: "Progress", actionUrl: "https://evil.example/steal" },
      status: "unread",
      priority: "medium",
      read_at: null,
      created_at: new Date("2026-10-15T10:00:00.000Z"),
    });

    await NotificationService.create({ recipient_id: "recipient-1" });

    expect(mockRealtimeHub.publishToUser).toHaveBeenCalledWith(
      "recipient-1",
      "notification.created",
      {
        notification: expect.objectContaining({
          id: "notification-1",
          recipient_id: "recipient-1",
          target_path: `/tasks/${TASK_ID}?tab=work`,
        }),
        unreadIncrement: 1,
      },
    );
  });

  test("publishes zero unread increment for an already-read notification", async () => {
    mockNotificationData.createNotification.mockResolvedValue({
      id: "notification-2",
      recipient_id: "recipient-1",
      type: "task_started",
      related_task_id: TASK_ID,
      content: { title: "Started" },
      status: "read",
      priority: "medium",
      read_at: new Date("2026-10-15T10:00:00.000Z"),
      created_at: new Date("2026-10-15T09:00:00.000Z"),
    });

    await NotificationService.create({ recipient_id: "recipient-1" });

    expect(mockRealtimeHub.publishToUser).toHaveBeenCalledWith(
      "recipient-1",
      "notification.created",
      expect.objectContaining({
        notification: expect.objectContaining({ target_path: `/tasks/${TASK_ID}` }),
        unreadIncrement: 0,
      }),
    );
  });
});

