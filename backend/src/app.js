require("./config/loadEnv");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { errorHandler, notFound } = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");
const requestContext = require("./middleware/requestContext");
const requestLogger = require("./middleware/requestLogger");
const { isDatabaseReady } = require("./config/database");
const { parseOrigins } = require("./config/environment");
const { errors } = require("./utils/appError");

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
const profileRoutes = require("./routes/profile.routes");
const teamRoutes = require("./routes/team.routes");
const projectRoutes = require("./routes/project.routes");
const discoveryRoutes = require("./routes/discovery.routes");
const hackathonRoutes = require("./routes/hackathon.routes");
const opportunityRoutes = require("./routes/opportunity.routes");
const organizationRoutes = require("./routes/organization.routes");

// Create Express app
const app = express();
const production = (process.env.APP_ENV || process.env.NODE_ENV) === "production";

app.disable("x-powered-by");
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || (production ? 1 : 0));
if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);

// Establish correlation before parsers so malformed request bodies also carry
// a request ID in their response and logs.
app.use(requestContext);
app.use(requestLogger);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  referrerPolicy: { policy: "no-referrer" },
  strictTransportSecurity: production ? undefined : false,
}));

// CORS configuration with an exact origin allowlist
const normalizeOrigin = (origin) => (origin ? origin.replace(/\/$/, "") : origin);
const allowedOrigins = parseOrigins(process.env).map(normalizeOrigin);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server or tools (no origin header)
    if (!origin) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);

    // Exact allowlist match
    if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);

    return callback(errors.forbidden("Origin is not allowed by CORS"));
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Body parser middleware
const bodyLimit = Number(process.env.API_BODY_LIMIT_BYTES) || 1024 * 1024;
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// Cookie parser
app.use(cookieParser());

// Liveness confirms only that the HTTP process can answer. Readiness is a
// separate dependency-aware endpoint for the deployment platform.
app.get("/health", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ status: "ok", request_id: req.requestId });
});

app.get("/api/ready", (req, res) => {
  const ready = isDatabaseReady();
  res.setHeader("Cache-Control", "no-store");
  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "unavailable",
    checks: { database: ready ? "ready" : "unavailable" },
    request_id: req.requestId,
  });
});

// Rate limiting (exclude the long-lived SSE stream endpoint).
app.use("/api/", (req, res, next) => {
  if (req.path.startsWith("/realtime/stream")) return next();
  return apiLimiter(req, res, next);
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/freelancer", freelancerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api", teamRoutes);
app.use("/api", projectRoutes);
app.use("/api", hackathonRoutes);
app.use("/api", opportunityRoutes);
app.use("/api", organizationRoutes);
app.use("/api", discoveryRoutes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;
