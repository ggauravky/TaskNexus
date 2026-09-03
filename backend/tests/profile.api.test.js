const request = require("supertest");

process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = "phase2-api-access-secret";
process.env.JWT_REFRESH_SECRET = "phase2-api-refresh-secret";
process.env.ALLOWED_ORIGINS = "http://localhost:5173";

jest.mock("../src/config/supabase", () => ({ from: jest.fn(), rpc: jest.fn() }));
jest.mock("../src/data/userData", () => ({
  findUserById: jest.fn(),
  findUserByEmail: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  findUsers: jest.fn(),
  comparePassword: jest.fn(),
}));
jest.mock("../src/services/profileService", () => ({
  getOwnProfile: jest.fn(),
  updateOwnProfile: jest.fn(),
  getPublicProfile: jest.fn(),
  checkUsername: jest.fn(),
  createEducation: jest.fn(),
  updateEducation: jest.fn(),
  deleteEducation: jest.fn(),
  replaceSkills: jest.fn(),
  searchSkills: jest.fn(),
}));

const userData = require("../src/data/userData");
const profileService = require("../src/services/profileService");
const { generateTokens } = require("../src/config/jwt");
const { errors } = require("../src/utils/appError");
const app = require("../src/app");

const user = {
  id: "00000000-0000-4000-8000-000000000201",
  email: "owner@example.com",
  role: "freelancer",
  status: "active",
  profile: { firstName: "Mira", lastName: "Sen" },
};

describe("Phase 2 profile API contracts", () => {
  let token;
  beforeEach(() => {
    jest.clearAllMocks();
    token = generateTokens(user.id, user.role).accessToken;
    userData.findUserById.mockResolvedValue(user);
  });

  test("own profile route requires authentication", async () => {
    const response = await request(app).get("/api/profile");
    expect(response.status).toBe(401);
    expect(profileService.getOwnProfile).not.toHaveBeenCalled();
  });

  test("own profile uses the authenticated identity and canonical envelope", async () => {
    profileService.getOwnProfile.mockResolvedValue({ account: { id: user.id }, profile: {}, skills: [], education: [] });
    const response = await request(app).get("/api/profile").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, data: { account: { id: user.id } } });
    expect(profileService.getOwnProfile).toHaveBeenCalledWith(user);
  });

  test("public profile route returns only the service public DTO", async () => {
    profileService.getPublicProfile.mockResolvedValue({ username: "mira-sen", name: { display: "Mira Sen" }, skills: [] });
    const response = await request(app).get("/api/public/profiles/mira-sen");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ username: "mira-sen", name: { display: "Mira Sen" }, skills: [] });
  });

  test("private and missing public profiles share the same 404 contract", async () => {
    profileService.getPublicProfile.mockRejectedValue(errors.notFound("Profile not found"));
    const response = await request(app).get("/api/public/profiles/private-user");
    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({ code: "NOT_FOUND", message: "Profile not found" });
  });

  test("education mutation passes the authenticated owner id", async () => {
    const educationId = "00000000-0000-4000-8000-000000000202";
    profileService.updateEducation.mockResolvedValue({ id: educationId });
    const response = await request(app)
      .put(`/api/profile/education/${educationId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ institution: "Institute", degreeCourse: "Course", startYear: 2021 });
    expect(response.status).toBe(200);
    expect(profileService.updateEducation).toHaveBeenCalledWith(user.id, educationId, expect.any(Object));
  });

  test("skill mutation ignores any caller-supplied user id", async () => {
    profileService.replaceSkills.mockResolvedValue([]);
    const response = await request(app)
      .put("/api/profile/skills")
      .set("Authorization", `Bearer ${token}`)
      .send({ userId: "00000000-0000-4000-8000-000000000999", skills: [] });
    expect(response.status).toBe(200);
    expect(profileService.replaceSkills).toHaveBeenCalledWith(user, []);
  });
});
