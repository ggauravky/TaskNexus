const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");
const { BUSINESS_RULES } = require("../config/constants");

const uploadsRoot = process.env.UPLOAD_PATH
  ? path.resolve(process.env.UPLOAD_PATH)
  : path.join(__dirname, "../../uploads");
const commentsDir = path.join(uploadsRoot, "comments");

if (!fs.existsSync(commentsDir)) {
  fs.mkdirSync(commentsDir, { recursive: true });
}

const MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "application/zip": ".zip",
};

const startsWithBytes = (buffer, bytes) =>
  bytes.every((byte, index) => buffer[index] === byte);

const hasExpectedSignature = (buffer, mimeType) => {
  if (mimeType === "image/jpeg") return startsWithBytes(buffer, [0xff, 0xd8, 0xff]);
  if (mimeType === "image/png") {
    return startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (mimeType === "image/gif") {
    const header = buffer.subarray(0, 6).toString("ascii");
    return header === "GIF87a" || header === "GIF89a";
  }
  if (mimeType === "application/pdf") {
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (mimeType === "application/msword") {
    return startsWithBytes(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  }
  if (
    mimeType === "application/zip" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return (
      startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
      startsWithBytes(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
      startsWithBytes(buffer, [0x50, 0x4b, 0x07, 0x08])
    );
  }
  if (mimeType === "video/mp4" || mimeType === "video/quicktime") {
    return buffer.subarray(4, 8).toString("ascii") === "ftyp";
  }
  return false;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, commentsDir),
  filename: (req, file, cb) => {
    const extension = MIME_EXTENSIONS[file.mimetype];
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = BUSINESS_RULES.ALLOWED_FILE_TYPES || [];
  if (!allowedTypes.includes(file.mimetype) || !MIME_EXTENSIONS[file.mimetype]) {
    cb(
      new Error(
        `Unsupported file type "${file.mimetype}". Allowed: ${allowedTypes.join(", ")}`,
      ),
    );
    return;
  }
  cb(null, true);
};

const commentAttachmentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: BUSINESS_RULES.MAX_FILE_SIZE || 10 * 1024 * 1024,
    files: 5,
  },
});

const validateUploadedFiles = async (req, res, next) => {
  const files = Array.isArray(req.files) ? req.files : [];
  if (files.length === 0) return next();

  try {
    for (const file of files) {
      const handle = await fs.promises.open(file.path, "r");
      const buffer = Buffer.alloc(16);
      await handle.read(buffer, 0, buffer.length, 0);
      await handle.close();

      if (!hasExpectedSignature(buffer, file.mimetype)) {
        const error = new Error("Attachment content does not match its declared file type");
        error.statusCode = 400;
        throw error;
      }
    }
    next();
  } catch (error) {
    await Promise.all(
      files.map((file) => fs.promises.unlink(file.path).catch(() => undefined)),
    );
    next(error);
  }
};

module.exports = {
  commentAttachmentUpload,
  validateUploadedFiles,
  commentsDir,
};
