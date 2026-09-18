jest.mock("../src/data/taskData", () => ({
  findTaskById: jest.fn(),
}));
jest.mock("../src/services/collaborationService", () => ({
  ensureTaskAccess: jest.fn(),
  listTaskComments: jest.fn(),
}));
jest.mock("../src/services/storage/storageProvider", () => ({
  openFile: jest.fn(),
}));

const taskData = require("../src/data/taskData");
const collaborationService = require("../src/services/collaborationService");
const storageProvider = require("../src/services/storage/storageProvider");
const taskController = require("../src/controllers/taskController");

const attachment = {
  filename: "opaque-file.pdf",
  originalName: "private.pdf",
  mimeType: "application/pdf",
  storageProvider: "gridfs",
  storageId: "507f1f77bcf86cd799439011",
};

const response = () => ({
  setHeader: jest.fn(),
  type: jest.fn(),
  attachment: jest.fn(),
});

describe("private attachment authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    collaborationService.ensureTaskAccess.mockImplementation(() => undefined);
    taskData.findTaskById.mockResolvedValue({ id: "task-1", client_id: "owner-1", freelancer_id: "worker-1" });
    collaborationService.listTaskComments.mockResolvedValue([{ attachments: [attachment] }]);
  });

  test("does not touch storage when task authorization fails", async () => {
    const denied = Object.assign(new Error("Not authorized"), { statusCode: 403 });
    collaborationService.ensureTaskAccess.mockImplementation(() => { throw denied; });
    const next = jest.fn();

    await taskController.downloadTaskAttachment({
      params: { id: "task-1", filename: attachment.filename },
      user: { id: "outsider-1", role: "freelancer" },
    }, response(), next);

    expect(next).toHaveBeenCalledWith(denied);
    expect(collaborationService.listTaskComments).not.toHaveBeenCalled();
    expect(storageProvider.openFile).not.toHaveBeenCalled();
  });

  test("streams an attachment only after task authorization and metadata lookup", async () => {
    const stream = { on: jest.fn().mockReturnThis(), pipe: jest.fn() };
    storageProvider.openFile.mockResolvedValue(stream);
    const res = response();
    const next = jest.fn();

    await taskController.downloadTaskAttachment({
      params: { id: "task-1", filename: attachment.filename },
      user: { id: "owner-1", role: "client" },
    }, res, next);

    expect(collaborationService.ensureTaskAccess).toHaveBeenCalled();
    expect(storageProvider.openFile).toHaveBeenCalledWith(attachment);
    expect(res.attachment).toHaveBeenCalledWith("private.pdf");
    expect(stream.pipe).toHaveBeenCalledWith(res);
    expect(next).not.toHaveBeenCalled();
  });
});
