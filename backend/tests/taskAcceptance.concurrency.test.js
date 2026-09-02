let mockWinner = null;

jest.mock("../src/config/supabase", () => ({
  rpc: jest.fn(async (_name, params) => {
    if (mockWinner) return { data: [], error: null };
    mockWinner = params.p_freelancer_id;
    return {
      data: [{
        id: params.p_task_id,
        freelancer_id: mockWinner,
        status: "assigned",
      }],
      error: null,
    };
  }),
}));
jest.mock("../src/data/localTaskStore", () => ({}));
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
