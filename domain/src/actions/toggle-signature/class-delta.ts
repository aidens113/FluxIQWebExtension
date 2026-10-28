// The class tokens one element gained and lost between two looks, leaving out
// the tokens that only say what the pointer, the keyboard or a request is
// doing (a hover, a focus ring, a spinner), which come and go without the
// control's state having changed.

const TRANSIENT = ["focus", "hover", "active", "busy", "loading", "pending", "animating", "disabled"];

export function webToggleClassDelta(before: readonly string[], after: readonly string[]): { gains: string[]; loses: string[] } {
  const steady = (token: string): boolean => !TRANSIENT.some((word) => token.toLowerCase().includes(word));
  return {
    gains: after.filter((token) => !before.includes(token) && steady(token)),
    loses: before.filter((token) => !after.includes(token) && steady(token))
  };
}
