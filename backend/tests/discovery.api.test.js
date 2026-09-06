const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "phase6-api-access-secret";
process.env.JWT_REFRESH_SECRET = "phase6-api-refresh-secret";
process.env.ALLOWED_ORIGINS = "http://localhost:5173";

jest.mock("../src/data/userData", () => ({
  findUserById: jest.fn(),
  findUserByEmail: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  findUsers: jest.fn(),
  comparePassword: jest.fn(),
}));
jest.mock("../src/services/discoveryService", () => ({ discoverPeople: jest.fn() }));
jest.mock("../src/services/teamOpeningService", () => ({
  listPublicOpenings: jest.fn(),
  listTeamOpenings: jest.fn(),
  createOpening: jest.fn(),
  updateOpening: jest.fn(),
  closeOpening: jest.fn(),
  candidateSearch: jest.fn(),
}));
jest.mock("../src/services/collaborationRequestService", () => ({
  createOpeningInterest: jest.fn(),
  listRequests: jest.fn(),
  createRequest: jest.fn(),
  respond: jest.fn(),
  cancel: jest.fn(),
  listBlocks: jest.fn(),
  blockUser: jest.fn(),
  unblockUser: jest.fn(),
}));

const userData = require("../src/data/userData");
const discoveryService = require("../src/services/discoveryService");
const openingService = require("../src/services/teamOpeningService");
const requestService = require("../src/services/collaborationRequestService");
const { generateTokens } = require("../src/config/jwt");
const app = require("../src/app");

const IDS = {
  user: "61000000-0000-4000-8000-000000000001",
  recipient: "61000000-0000-4000-8000-000000000002",
  team: "61000000-0000-4000-8000-000000000003",
  opening: "61000000-0000-4000-8000-000000000004",
  request: "61000000-0000-4000-8000-000000000005",
};
const user = { id: IDS.user, email: "phase6@example.com", role: "freelancer", status: "active", profile: {} };

describe("Phase 6 discovery API contracts", () => {
  let token;

  beforeEach(() => {
    jest.clearAllMocks();
    token = generateTokens(user.id, user.role).accessToken;
    userData.findUserById.mockResolvedValue(user);
  });

  test("bulk people discovery requires authentication", async () => {
    const response = await request(app).get("/api/people");
    expect(response.status).toBe(401);
    expect(discoveryService.discoverPeople).not.toHaveBeenCalled();
  });

  test("people discovery uses the authenticated identity and canonical envelope", async () => {
    discoveryService.discoverPeople.mockResolvedValue({ items: [{ id: IDS.recipient }], meta: { page: 1 }, filters: { skillMode: "all" } });
    const response = await request(app).get("/api/people?skillMode=all").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: [{ id: IDS.recipient }], meta: { page: 1, filters: { skillMode: "all" } } });
    expect(discoveryService.discoverPeople).toHaveBeenCalledWith(user.id, expect.objectContaining({ skillMode: "all" }));
  });

  test("structured query operator objects fail validation before reaching discovery", async () => {
    const response = await request(app).get("/api/people?roles[$ne]=backend_developer").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(400);
    expect(discoveryService.discoverPeople).not.toHaveBeenCalled();
  });

  test("opening creation derives actor and team from authenticated route context", async () => {
    openingService.createOpening.mockResolvedValue({ id: IDS.opening, teamId: IDS.team });
    const body = { title: "Backend collaborator", role: "backend_developer", createdBy: IDS.recipient };
    const response = await request(app).post(`/api/teams/${IDS.team}/openings`).set("Authorization", `Bearer ${token}`).send(body);
    expect(response.status).toBe(201);
    expect(openingService.createOpening).toHaveBeenCalledWith(IDS.team, user.id, expect.objectContaining({ title: body.title }));
  });

  test("collaboration creation cannot replace the authenticated sender", async () => {
    requestService.createRequest.mockResolvedValue({ id: IDS.request, sender: { id: user.id } });
    const body = { recipientId: IDS.recipient, senderId: IDS.recipient, message: "Build together?" };
    const response = await request(app).post("/api/collaboration-requests").set("Authorization", `Bearer ${token}`).send(body);
    expect(response.status).toBe(201);
    expect(requestService.createRequest).toHaveBeenCalledWith(user.id, expect.objectContaining({ recipientId: IDS.recipient }));
  });

  test("request response and cancellation actions use the authenticated actor", async () => {
    requestService.respond.mockResolvedValue({ id: IDS.request, status: "accepted" });
    requestService.cancel.mockResolvedValue({ id: IDS.request, status: "cancelled" });
    const accepted = await request(app).post(`/api/collaboration-requests/${IDS.request}/accept`).set("Authorization", `Bearer ${token}`);
    const cancelled = await request(app).delete(`/api/collaboration-requests/${IDS.request}`).set("Authorization", `Bearer ${token}`);
    expect(accepted.status).toBe(200);
    expect(cancelled.status).toBe(200);
    expect(requestService.respond).toHaveBeenCalledWith(IDS.request, user.id, "accepted");
    expect(requestService.cancel).toHaveBeenCalledWith(IDS.request, user.id);
  });

  test("block endpoints derive the blocker from authentication", async () => {
    requestService.blockUser.mockResolvedValue({ id: IDS.recipient });
    const response = await request(app).post("/api/user-blocks").set("Authorization", `Bearer ${token}`).send({ userId: IDS.recipient, blockerId: IDS.recipient });
    expect(response.status).toBe(201);
    expect(requestService.blockUser).toHaveBeenCalledWith(user.id, IDS.recipient);
  });
});
