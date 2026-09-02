const domain = require("../../shared/contracts/domain.json");
const contracts = require("../src/contracts/domain");

describe("canonical domain contract", () => {
  test("backend enums are generated from the shared contract", () => {
    expect(Object.values(contracts.TASK_STATUS)).toEqual(domain.taskStatuses);
    expect(Object.values(contracts.TASK_TYPES)).toEqual(domain.taskTypes);
    expect(Object.values(contracts.NOTIFICATION_TYPES)).toEqual(domain.notificationTypes);
  });

  test("every task status has an explicit transition list", () => {
    expect(Object.keys(domain.taskTransitions).sort()).toEqual(
      [...domain.taskStatuses].sort(),
    );
  });

  test("terminal states cannot transition", () => {
    expect(domain.taskTransitions.completed).toEqual([]);
    expect(domain.taskTransitions.cancelled).toEqual([]);
  });
});
