export const createLatestRequestGuard = () => {
  let generation = 0;

  return Object.freeze({
    begin: () => {
      generation += 1;
      return generation;
    },
    invalidate: () => {
      generation += 1;
    },
    isCurrent: (candidate) => candidate === generation,
  });
};

export default createLatestRequestGuard;
