const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { BUSINESS_RULES } = require("../config/constants");

const commentsDir = path.join(__dirname, "../../uploads/comments");

if (!fs.existsSync(commentsDir)) {
  fs.mkdirSync(commentsDir, { recursive: true });
}

const safeBaseName = (filename) => {
  const extension = path.extname(filename || "");
  const base = path
    .basename(filename || "attachment", extension)
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 40);
  return `${base || "attachment"}${extension || ""}`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, commentsDir),
  filename: (req, file, cb) => {
    const stamp = Date.now();
    cb(null, `${stamp}-${safeBaseName(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = BUSINESS_RULES.ALLOWED_FILE_TYPES || [];
  if (!allowedTypes.includes(file.mimetype)) {
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

module.exports = {
  commentAttachmentUpload,
};
