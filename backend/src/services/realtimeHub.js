const HEARTBEAT_MS = 25000;

class RealtimeHub {
  constructor() {
    this.userStreams = new Map();
    this.roleStreams = new Map();
    this.allStreams = new Set();

    setInterval(() => {
      for (const stream of this.allStreams) {
        this.writeSse(stream, "ping", {
          ts: new Date().toISOString(),
        });
      }
    }, HEARTBEAT_MS).unref();
  }

  subscribe(req, res, user) {
    const userId = String(user.id);
    const role = String(user.role || "");
    const stream = { res, userId, role };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    this.allStreams.add(stream);
    this.addStream(this.userStreams, userId, stream);
    if (role) {
      this.addStream(this.roleStreams, role, stream);
    }

    this.writeSse(stream, "connected", {
      userId,
      role,
      connectedAt: new Date().toISOString(),
    });

    req.on("close", () => {
      this.removeStream(this.userStreams, userId, stream);
      if (role) {
        this.removeStream(this.roleStreams, role, stream);
      }
      this.allStreams.delete(stream);
      res.end();
    });
  }

  publishToUser(userId, event, payload = {}) {
    const streams = this.userStreams.get(String(userId));
    if (!streams) return;

    for (const stream of streams) {
      this.writeSse(stream, event, payload);
    }
  }

  publishToUsers(userIds = [], event, payload = {}) {
    const seen = new Set();

    for (const rawId of userIds) {
      const id = String(rawId || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      this.publishToUser(id, event, payload);
    }
  }

  publishToRole(role, event, payload = {}) {
    const streams = this.roleStreams.get(String(role));
    if (!streams) return;

    for (const stream of streams) {
      this.writeSse(stream, event, payload);
    }
  }

  publish(activity = {}) {
    const {
      users = [],
      roles = [],
      event = "message",
      payload = {},
    } = activity;

    if (Array.isArray(users) && users.length > 0) {
      this.publishToUsers(users, event, payload);
    }

    if (Array.isArray(roles) && roles.length > 0) {
      for (const role of roles) {
        this.publishToRole(role, event, payload);
      }
    }
  }

  addStream(bucket, key, stream) {
    const existing = bucket.get(key) || new Set();
    existing.add(stream);
    bucket.set(key, existing);
  }

  removeStream(bucket, key, stream) {
    const existing = bucket.get(key);
    if (!existing) return;
    existing.delete(stream);
    if (existing.size === 0) {
      bucket.delete(key);
    }
  }

  writeSse(stream, event, payload) {
    try {
      stream.res.write(`event: ${event}\n`);
      stream.res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
      this.removeStream(this.userStreams, stream.userId, stream);
      this.removeStream(this.roleStreams, stream.role, stream);
      this.allStreams.delete(stream);
    }
  }
}

module.exports = new RealtimeHub();
