// Where a read that loaded more began, in a list that grew by appending: the
// number of items before the first one the read returns. Said only where the
// page shows the growth -- the items the list had when the read began are
// still there, in place, with more after them -- because a list that replaced
// or reordered its items has no offset a count could name.

/** Whether `after` is `before` with items added after it: the earlier items kept, connected and first. */
export function grewByAppending(before: readonly Element[], after: readonly Element[]): boolean {
  if (before.length === 0 || after.length <= before.length) return false;
  return before.every((element, index) => element.isConnected && after[index] === element);
}
