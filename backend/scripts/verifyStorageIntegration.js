require("../src/config/loadEnv");
const crypto = require("node:crypto");
const { once } = require("node:events");
const { assertStagingMutationAllowed } = require("./lib/stagingSafety");
const { connectDatabase, disconnectDatabase } = require("../src/config/database");

process.env.UPLOAD_STORAGE_MODE = "gridfs";
process.env.GRIDFS_BUCKET_NAME = "tasknexus_attachments_phase11_qa";
const storage = require("../src/services/storage/storageProvider");

const readStream = async (stream) => {
  const chunks = [];
  stream.on("data", (chunk) => chunks.push(chunk));
  await once(stream, "end");
  return Buffer.concat(chunks);
};

const run = async () => {
  assertStagingMutationAllowed();
  const bytes = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    crypto.randomBytes(256),
  ]);
  let attachment;

  try {
    await connectDatabase();
    [attachment] = await storage.uploadFiles([{
      originalname: "phase11-persistence.png",
      mimetype: "image/png",
      size: bytes.length,
      buffer: bytes,
    }], { taskId: "phase11-storage-qa", commentId: "phase11-storage-qa" });

    await disconnectDatabase();
    await connectDatabase();
    const restored = await readStream(await storage.openFile(attachment));
    if (!crypto.timingSafeEqual(crypto.createHash("sha256").update(bytes).digest(), crypto.createHash("sha256").update(restored).digest())) {
      throw new Error("GridFS content hash changed after reconnect");
    }

    await storage.deleteFiles([attachment]);
    await storage.openFile(attachment).then(
      () => { throw new Error("GridFS cleanup did not remove the QA file"); },
      (error) => { if (error.code !== "ENOENT") throw error; },
    );
    attachment = null;
    process.stdout.write("GridFS storage verification passed: upload, reconnect, private stream retrieval, hash, and cleanup.\n");
  } finally {
    if (attachment) await storage.deleteFiles([attachment]).catch(() => undefined);
    await disconnectDatabase();
  }
};

run().catch((error) => {
  process.stderr.write(`GridFS storage verification failed: ${error.message}\n`);
  process.exitCode = 1;
});
