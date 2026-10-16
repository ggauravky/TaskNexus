const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.APP_ENV = "test";
process.env.JWT_ACCESS_SECRET = "phase-c-api-access-secret";
process.env.JWT_REFRESH_SECRET = "phase-c-api-refresh-secret";
process.env.ALLOWED_ORIGINS = "http://localhost:5173";

jest.mock("../src/data/userData", () => ({
  findUserById: jest.fn(),
  findUserByEmail: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  findUsers: jest.fn(),
  comparePassword: jest.fn(),
}));
jest.mock("../src/services/searchService", () => ({ search: jest.fn() }));

const userData = require("../src/data/userData");
const searchService = require("../src/services/searchService");
const { generateTokens } = require("../src/config/jwt");
const { errors } = require("../src/utils/appError");
const app = require("../src/app");

const groups = () => ({
  teams: [], projects: [], people: [], hackathons: [], opportunities: [], organizations: [], tasks: [],
});
const user = {
  id: "73000000-0000-4000-8000-000000000001",
  email: "phase-c@example.test",
  role: "client",
  status: "active",
  profile: {},
};

describe("Phase C global search API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userData.findUserById.mockResolvedValue(user);
    searchService.search.mockResolvedValue({ query: "react", groups: groups() });
  });

  const tokenFor = (role = user.role) => generateTokens(user.id, role).accessToken;

  test("requires authentication", async () => {
    const response = await request(app).get("/api/search?q=react");
    expect(response.status).toBe(401);
    expect(searchService.search).not.toHaveBeenCalled();
  });

  test.each([
    ["missing", "/api/search"],
    ["blank", "/api/search?q=%20%20"],
    ["one character", "/api/search?q=x"],
    ["structured", "/api/search?q[$ne]=react"],
    ["overlong", `/api/search?q=${"x".repeat(81)}`],
  ])("rejects %s input with the canonical validation envelope", async (_name, path) => {
    const response = await request(app).get(path).set("Authorization", `Bearer ${tokenFor()}`);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, error: { code: expect.any(String), message: "Validation failed" } });
    expect(searchService.search).not.toHaveBeenCalled();
  });

  test.each(["client", "freelancer", "admin"])("passes only authenticated %s identity and normalized query", async (role) => {
    const actor = { ...user, role };
    userData.findUserById.mockResolvedValue(actor);
    searchService.search.mockResolvedValue({ query: "react builders", groups: groups() });

    const response = await request(app)
      .get("/api/search?q=%20react%20%20builders%20&limit=100&role=admin")
      .set("Authorization", `Bearer ${tokenFor(role)}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { query: "react builders", groups: groups() } });
    expect(searchService.search).toHaveBeenCalledWith({
      query: "react builders",
      viewer: { id: actor.id, role },
    });
  });

  test("uses the canonical safe error envelope", async () => {
    searchService.search.mockRejectedValue(errors.serviceUnavailable("Search temporarily unavailable"));
    const response = await request(app).get("/api/search?q=react").set("Authorization", `Bearer ${tokenFor()}`);
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ success: false, error: { code: "SERVICE_UNAVAILABLE", message: "Search temporarily unavailable" } });
    expect(response.body).not.toHaveProperty("stack");
  });
});
