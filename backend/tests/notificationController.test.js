const mockNotificationData = {
  listNotifications: jest.fn(),
  countNotifications: jest.fn(),
  findNotifications: jest.fn(),
  updateNotification: jest.fn(),
  updateNotificationForRecipient: jest.fn(),
  updateManyNotifications: jest.fn(),
  deleteNotification: jest.fn(),
  deleteNotificationForRecipient: jest.fn(),
};

jest.mock("../src/data/notificationData", () => mockNotificationData);
jest.mock("../src/data/userData", () => ({}));
jest.mock("../src/utils/logger", () => ({ info: jest.fn(), error: jest.fn() }));

const notificationController = require("../src/controllers/notificationController");

const TASK_ID = "00000000-0000-4000-8000-000000000101";
const NOTIFICATION_ID = "00000000-0000-4000-8000-000000000201";

const response = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

const notification = (overrides = {}) => ({
  id: NOTIFICATION_ID,
  recipient_id: "owner-1",
  actor_id: "actor-1",
  type: "task_progress",
  related_task_id: TASK_ID,
  content: { title: "Progress updated", message: "Work moved forward." },
  status: "unread",
  priority: "medium",
  read_at: null,
  created_at: new Date("2026-10-15T10:00:00.000Z"),
  ...overrides,
});

describe("notification controller ownership and pagination", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationData.listNotifications.mockResolvedValue({
      items: [notification()],
      total: 21,
      page: 2,
      limit: 8,
    });
    mockNotificationData.countNotifications.mockResolvedValue(4);
    mockNotificationData.updateNotificationForRecipient.mockResolvedValue(notification({
      status: "read",
      read_at: new Date("2026-10-15T10:05:00.000Z"),
    }));
    mockNotificationData.updateManyNotifications.mockResolvedValue({ matchedCount: 4, modifiedCount: 4 });
    mockNotificationData.deleteNotificationForRecipient.mockResolvedValue(notification());
  });

  test("pins paginated unread history and count to the authenticated owner", async () => {
    const req = {
      user: { id: "owner-1" },
      query: { unreadOnly: "true", page: "2", limit: "8" },
    };
    const res = response();
    const next = jest.fn();

    await notificationController.getNotifications(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockNotificationData.listNotifications).toHaveBeenCalledWith(expect.objectContaining({
      filters: { recipient_id: "owner-1", status: "unread" },
      page: 2,
      limit: 8,
    }));
    expect(mockNotificationData.countNotifications).toHaveBeenCalledWith({
      recipient_id: "owner-1",
      status: "unread",
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        unreadCount: 4,
        notifications: [expect.objectContaining({
          id: NOTIFICATION_ID,
          target_path: `/tasks/${TASK_ID}?tab=work`,
        })],
      }),
      meta: { pagination: expect.objectContaining({ page: 2, limit: 8, total: 21 }) },
    }));
  });

  test("marks one notification read through an atomic recipient-filtered update", async () => {
    const req = { user: { id: "owner-1" }, params: { id: NOTIFICATION_ID } };
    const res = response();
    const next = jest.fn();

    await notificationController.markAsRead(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockNotificationData.updateNotificationForRecipient).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      "owner-1",
      expect.objectContaining({ status: "read", read_at: expect.any(Date) }),
    );
    expect(mockNotificationData.findNotifications).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        id: NOTIFICATION_ID,
        status: "read",
        target_path: `/tasks/${TASK_ID}?tab=work`,
      }),
    }));
  });

  test("does not reveal a notification owned by another user", async () => {
    mockNotificationData.updateNotificationForRecipient.mockResolvedValue(null);
    const req = { user: { id: "other-user" }, params: { id: NOTIFICATION_ID } };
    const res = response();
    const next = jest.fn();

    await notificationController.markAsRead(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Notification not found" });
  });

  test("mark-all changes only the caller's unread notifications", async () => {
    const req = { user: { id: "owner-1" } };
    const res = response();
    const next = jest.fn();

    await notificationController.markAllAsRead(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockNotificationData.updateManyNotifications).toHaveBeenCalledWith(
      { recipient_id: "owner-1", status: "unread" },
      expect.objectContaining({ status: "read", read_at: expect.any(Date) }),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: { modifiedCount: 4 },
    }));
  });

  test("deletes one notification through an atomic recipient-filtered delete", async () => {
    const req = { user: { id: "owner-1" }, params: { id: NOTIFICATION_ID } };
    const res = response();
    const next = jest.fn();

    await notificationController.deleteNotification(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockNotificationData.deleteNotificationForRecipient).toHaveBeenCalledWith(
      NOTIFICATION_ID,
      "owner-1",
    );
    expect(mockNotificationData.findNotifications).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, message: "Notification deleted" });
  });

  test("returns the same safe 404 for a cross-user delete", async () => {
    mockNotificationData.deleteNotificationForRecipient.mockResolvedValue(null);
    const req = { user: { id: "other-user" }, params: { id: NOTIFICATION_ID } };
    const res = response();
    const next = jest.fn();

    await notificationController.deleteNotification(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Notification not found" });
  });
});

