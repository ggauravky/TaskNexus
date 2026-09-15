const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Readable } = require("node:stream");
const { finished } = require("node:stream/promises");
const { GridFSBucket, ObjectId } = require("mongodb");
const mongoose = require("mongoose");

const uploadsRoot = () => path.resolve(
  process.env.UPLOAD_PATH || path.join(__dirname, "../../../uploads"),
);

const safeOriginalName = (name) => {
  const base = path.basename(String(name || "attachment"));
  const cleaned = base.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim();
  return (cleaned || "attachment").slice(0, 120);
};

const extensionFor = (name) => {
  const extension = path.extname(safeOriginalName(name)).toLowerCase();
  return /^[.][a-z0-9]{1,8}$/.test(extension) ? extension : "";
};

const createStorageKey = (file) => `${crypto.randomUUID()}${extensionFor(file.originalname)}`;

class LocalStorageProvider {
  constructor() {
    this.directory = path.join(uploadsRoot(), "comments");
  }

  async upload(file, context) {
    await fs.promises.mkdir(this.directory, { recursive: true });
    const storageKey = createStorageKey(file);
    await fs.promises.writeFile(path.join(this.directory, storageKey), file.buffer, { flag: "wx" });
    return this.metadata(file, context, storageKey, null);
  }

  async open(attachment) {
    const storageKey = path.basename(String(attachment.storageKey || attachment.filename));
    const filePath = path.join(this.directory, storageKey);
    await fs.promises.access(filePath, fs.constants.R_OK);
    return fs.createReadStream(filePath);
  }

  async delete(attachment) {
    const storageKey = path.basename(String(attachment.storageKey || attachment.filename));
    await fs.promises.unlink(path.join(this.directory, storageKey)).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  metadata(file, context, storageKey, storageId) {
    return buildMetadata(file, context, storageKey, storageId, "local");
  }
}

class GridFsStorageProvider {
  bucket() {
    if (!mongoose.connection.db) throw new Error("MongoDB must be connected before using GridFS storage");
    return new GridFSBucket(mongoose.connection.db, {
      bucketName: process.env.GRIDFS_BUCKET_NAME || "tasknexus_attachments",
    });
  }

  async upload(file, context) {
    const storageKey = createStorageKey(file);
    const stream = this.bucket().openUploadStream(storageKey, {
      contentType: file.mimetype,
      metadata: {
        taskId: context.taskId,
        commentId: context.commentId,
        originalName: safeOriginalName(file.originalname),
      },
    });
    Readable.from(file.buffer).pipe(stream);
    await finished(stream);
    return buildMetadata(file, context, storageKey, String(stream.id), "gridfs");
  }

  async open(attachment) {
    const bucket = this.bucket();
    if (attachment.storageId && ObjectId.isValid(attachment.storageId)) {
      const id = new ObjectId(attachment.storageId);
      const exists = await bucket.find({ _id: id }).limit(1).next();
      if (!exists) throw Object.assign(new Error("Attachment file is unavailable"), { code: "ENOENT" });
      return bucket.openDownloadStream(id);
    }
    const storageKey = String(attachment.storageKey || attachment.filename);
    const exists = await bucket.find({ filename: storageKey }).limit(1).next();
    if (!exists) throw Object.assign(new Error("Attachment file is unavailable"), { code: "ENOENT" });
    return bucket.openDownloadStreamByName(storageKey);
  }

  async delete(attachment) {
    if (!attachment.storageId || !ObjectId.isValid(attachment.storageId)) return;
    await this.bucket().delete(new ObjectId(attachment.storageId)).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}

const buildMetadata = (file, context, storageKey, storageId, provider) => ({
  id: `att_${crypto.randomUUID()}`,
  originalName: safeOriginalName(file.originalname),
  filename: storageKey,
  storageKey,
  storageId,
  storageProvider: provider,
  size: file.size,
  mimeType: file.mimetype,
  url: `/api/tasks/${context.taskId}/attachments/${storageKey}`,
  uploadedAt: new Date().toISOString(),
});

const providerFor = (name = process.env.UPLOAD_STORAGE_MODE || "local") => {
  if (name === "gridfs") return new GridFsStorageProvider();
  if (name === "local") return new LocalStorageProvider();
  throw new Error("File attachment storage is disabled");
};

const uploadFiles = async (files, context) => {
  const provider = providerFor();
  const uploaded = [];
  try {
    for (const file of files) uploaded.push(await provider.upload(file, context));
    return uploaded;
  } catch (error) {
    await Promise.all(uploaded.map((attachment) => provider.delete(attachment).catch(() => undefined)));
    throw error;
  }
};

const deleteFiles = async (attachments) => {
  await Promise.all((attachments || []).map((attachment) =>
    providerFor(attachment.storageProvider).delete(attachment),
  ));
};

const openFile = (attachment) => providerFor(attachment.storageProvider).open(attachment);

module.exports = {
  GridFsStorageProvider,
  LocalStorageProvider,
  createStorageKey,
  deleteFiles,
  openFile,
  providerFor,
  safeOriginalName,
  uploadFiles,
};
