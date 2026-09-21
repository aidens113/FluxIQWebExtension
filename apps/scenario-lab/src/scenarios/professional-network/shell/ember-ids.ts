/**
 * Element ids the way a client-rendered app hands them out: a counter,
 * `ember412`, `ember413`, restarted on every render from a point the seed
 * decides. An id names an element for one rendering and means nothing the
 * next time, so a label's `for` resolves and nothing else should lean on it.
 * The client script continues from `next` for what it renders later.
 */
export type EmberIds = { next(): string; readonly peek: number };

export function emberIds(seed: number, salt: number): EmberIds {
  let counter = 200 + ((Math.abs(seed) * 7 + salt * 131) % 900);
  return {
    next: () => `ember${counter++}`,
    get peek() { return counter; },
  };
}
