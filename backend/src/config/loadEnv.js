const path = require("path");
const dotenv = require("dotenv");

const backendRoot = path.resolve(__dirname, "../..");

// Local overrides stay untracked; the regular .env file remains a fallback for
// existing deployments. dotenv does not overwrite variables already supplied
// by the process environment.
dotenv.config({ path: path.join(backendRoot, ".env.local") });
dotenv.config({ path: path.join(backendRoot, ".env") });
