jest.mock("../src/data/userData", () => ({
  findUserById: jest.fn(),
  updateUser: jest.fn(),
}));
jest.mock("../src/data/auditLogData", () => ({
  log: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../src/services/notificationService", () => ({
  create: jest.fn().mockResolvedValue(undefined),
}));

const userData = require("../src/data/userData");
const auditLogData = require("../src/data/auditLogData");
const adminController = require("../src/controllers/adminController");

describe("privacy account deactivation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userData.findUserById.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000101",
      role: "client",
      status: "active",
    });
    userData.updateUser.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000101",
      role: "client",
      status: "suspended",
    });
  });

  test("suspension revokes the persisted refresh session and records the change", async () => {
    const req = {
      params: { id: "00000000-0000-4000-8000-000000000101" },
      body: { status: "suspended" },
      user: { id: "00000000-0000-4000-8000-000000000999", role: "admin" },
      ip: "127.0.0.1",
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await adminController.updateUserStatus(req, res, next);

    expect(userData.updateUser).toHaveBeenCalledWith(req.params.id, {
      status: "suspended",
      refresh_token: null,
    });
    expect(auditLogData.log).toHaveBeenCalledWith(expect.objectContaining({
      action: "user_status_updated",
      resource_id: req.params.id,
      changes: { oldStatus: "active", newStatus: "suspended" },
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });
});
