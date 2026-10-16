const { CONFIRMATION, assertStagingMutationAllowed } = require("../scripts/lib/stagingSafety");

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_ARGV = [...process.argv];

const configure = ({ nodeEnv, appEnv, databaseName, confirmed = true }) => {
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;

  if (appEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = appEnv;

  if (databaseName === undefined) delete process.env.MONGODB_DB_NAME;
  else process.env.MONGODB_DB_NAME = databaseName;

  process.argv = confirmed
    ? [...ORIGINAL_ARGV, CONFIRMATION]
    : ORIGINAL_ARGV.filter((argument) => argument !== CONFIRMATION);
};

describe("staging mutation safety", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.argv = [...ORIGINAL_ARGV];
  });

  test.each([
    "tasknexus_development",
    "tasknexus_dev",
    "tasknexus_test",
    "tasknexus_testing",
    "tasknexus_integration",
    "tasknexus_qa",
  ])("allows an explicitly confirmed non-production database: %s", (databaseName) => {
    configure({ nodeEnv: "development", appEnv: "development", databaseName });

    expect(() => assertStagingMutationAllowed()).not.toThrow();
  });

  test.each([
    { nodeEnv: "production", appEnv: "development", databaseName: "tasknexus_development" },
    { nodeEnv: "development", appEnv: "production", databaseName: "tasknexus_development" },
    { nodeEnv: "development", appEnv: "development", databaseName: "tasknexus_prod" },
    { nodeEnv: "development", appEnv: "development", databaseName: "tasknexus_production" },
    { nodeEnv: "development", appEnv: "development", databaseName: "tasknexus_live" },
    { nodeEnv: "development", appEnv: "development", databaseName: "tasknexus_prod_testing" },
  ])("blocks production or production-like configuration %#", (configuration) => {
    configure(configuration);

    expect(() => assertStagingMutationAllowed()).toThrow(/production/i);
  });

  test.each([
    { nodeEnv: undefined, appEnv: "development", databaseName: "tasknexus_development" },
    { nodeEnv: "development", appEnv: undefined, databaseName: "tasknexus_development" },
    { nodeEnv: "development", appEnv: "development", databaseName: undefined },
  ])("fails closed when a required value is missing %#", (configuration) => {
    configure(configuration);

    expect(() => assertStagingMutationAllowed()).toThrow(/required/i);
  });

  test("blocks an ambiguous non-production database name", () => {
    configure({ nodeEnv: "development", appEnv: "development", databaseName: "tasknexus" });

    expect(() => assertStagingMutationAllowed()).toThrow(/development, test, integration, or QA/i);
  });

  test("still requires the explicit confirmation flag", () => {
    configure({
      nodeEnv: "development",
      appEnv: "development",
      databaseName: "tasknexus_development",
      confirmed: false,
    });

    expect(() => assertStagingMutationAllowed()).toThrow(CONFIRMATION);
  });
});
