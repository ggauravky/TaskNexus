let mockWinner = null;

jest.mock("../src/models", () => ({
  Task: {
    findOneAndUpdate: jest.fn((_filter, update) => ({
      lean: jest.fn(async () => {
        if (mockWinner) return null;
        mockWinner = update.$set.freelancer_id;
        return {
          _id: "11111111-1111-4111-8111-111111111111",
          freelancer_id: mockWinner,
          status: "assigned",
        };
      }),
    })),
  },
}));
jest.mock("../src/utils/logger", () => ({ warn: jest.fn() }));

const taskData = require("../src/data/taskData");

describe("atomic task acceptance", () => {
  beforeEach(() => { mockWinner = null; });

  test("two freelancers racing for one task produce exactly one winner", async () => {
    const attempts = await Promise.all([
      taskData.acceptTaskAtomically("11111111-1111-4111-8111-111111111111", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      taskData.acceptTaskAtomically("11111111-1111-4111-8111-111111111111", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    ]);
    expect(attempts.filter(Boolean)).toHaveLength(1);
    expect(attempts.find(Boolean)).toMatchObject({ status: "assigned" });
  });
});
