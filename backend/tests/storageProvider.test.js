const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { once } = require("node:events");

const readStream = async (stream) => {
  const chunks = [];
  stream.on("data", (chunk) => chunks.push(chunk));
  await once(stream, "end");
  return Buffer.concat(chunks);
};

describe("attachment storage provider", () => {
  let temporaryRoot;
  let storage;

  beforeEach(async () => {
    temporaryRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tasknexus-storage-"));
    process.env.UPLOAD_PATH = temporaryRoot;
    process.env.UPLOAD_STORAGE_MODE = "local";
    jest.resetModules();
    storage = require("../src/services/storage/storageProvider");
  });

  afterEach(async () => {
    delete process.env.UPLOAD_PATH;
    delete process.env.UPLOAD_STORAGE_MODE;
    await fs.promises.rm(temporaryRoot, { recursive: true, force: true });
  });

  test("sanitizes untrusted display names and generates opaque storage keys", () => {
    expect(storage.safeOriginalName("../../private résumé?.pdf")).toBe("private r_sum__.pdf");
    const key = storage.createStorageKey({ originalname: "../../report.pdf" });
    expect(key).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(key).not.toContain("report");
  });

  test("uploads, streams, and deletes a private local-development attachment", async () => {
    const bytes = Buffer.from("TaskNexus attachment test");
    const [attachment] = await storage.uploadFiles([{
      originalname: "notes.pdf",
      mimetype: "application/pdf",
      size: bytes.length,
      buffer: bytes,
    }], { taskId: "task-1", commentId: "comment-1" });

    expect(attachment).toMatchObject({
      originalName: "notes.pdf",
      storageProvider: "local",
      mimeType: "application/pdf",
    });
    expect(await readStream(await storage.openFile(attachment))).toEqual(bytes);
    await storage.deleteFiles([attachment]);
    await expect(storage.openFile(attachment)).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("removes already-persisted files when a later upload fails", async () => {
    const uploaded = { storageProvider: "local", filename: "first.pdf" };
    const failure = new Error("provider unavailable");
    const upload = jest.spyOn(storage.LocalStorageProvider.prototype, "upload")
      .mockResolvedValueOnce(uploaded)
      .mockRejectedValueOnce(failure);
    const remove = jest.spyOn(storage.LocalStorageProvider.prototype, "delete")
      .mockResolvedValue(undefined);

    await expect(storage.uploadFiles([
      { originalname: "first.pdf", buffer: Buffer.from("first") },
      { originalname: "second.pdf", buffer: Buffer.from("second") },
    ], { taskId: "task-1", commentId: "comment-1" })).rejects.toBe(failure);

    expect(upload).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledWith(uploaded);
  });
});
