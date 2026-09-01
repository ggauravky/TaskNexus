require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");
const logger = require("./utils/logger");

// Import routes
const authRoutes = require("./routes/auth.routes");
const taskRoutes = require("./routes/task.routes");
const clientRoutes = require("./routes/client.routes");
const freelancerRoutes = require("./routes/freelancer.routes");
const adminRoutes = require("./routes/admin.routes");
const notificationRoutes = require("./routes/notification.routes");
const settingsRoutes = require("./routes/settings.routes");
const realtimeRoutes = require("./routes/realtime.routes");
const publicRoutes = require("./routes/public.routes");

// Create Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration with an exact origin allowlist
const normalizeOrigin = (origin) => (origin ? origin.replace(/\/$/, "") : origin);
const parseAllowedOrigins = () =>
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => normalizeOrigin(o.trim()))
    .filter(Boolean);

const allowedOrigins = parseAllowedOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server or tools (no origin header)
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);

    // Exact allowlist match
    if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Cookie parser
app.use(cookieParser());

// Logging middleware
const safeRequestFormat = (tokens, req, res) => {
  const pathOnly = req.originalUrl.split("?")[0];
  return [
    tokens.method(req, res),
    pathOnly,
    tokens.status(req, res),
    tokens.res(req, res, "content-length"),
    "-",
    `${tokens["response-time"](req, res)} ms`,
  ].join(" ");
};

if (process.env.NODE_ENV === "development") {
  app.use(morgan(safeRequestFormat));
} else {
  app.use(morgan(safeRequestFormat, { stream: logger.stream }));
}

// Rate limiting (exclude SSE stream endpoint)
app.use("/api/", (req, res, next) => {
  if (req.path.startsWith("/realtime/stream")) {
    return next();
  }
  return apiLimiter(req, res, next);
});

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "TaskNexus API is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/freelancer", freelancerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/realtime", realtimeRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;
