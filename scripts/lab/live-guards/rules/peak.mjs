// Rule `peak`: no live run starts on a weekday (Monday to Friday, by the UTC
// day) inside 01:00-04:00 or 06:00-10:00 UTC, DeepSeek's peak pricing hours.
// At peak the same $0.10 per-build ceiling buys about half the decisions, so a
// run launched then measures the price, not the product (the user's rule).
//
// Times come from `state.now` alone, so the rule is as deterministic as the
// clock its caller injects. Each window's start is inclusive and its end
// exclusive; the windows neither overlap nor touch, so a window's end is
// always the next off-peak start.

const HOUR_MS = 60 * 60 * 1000;

/** The peak windows, in whole UTC hours: [start, end). */
export const PEAK_WINDOWS_UTC = [{ startHour: 1, endHour: 4 }, { startHour: 6, endHour: 10 }];

/** @param {import("./guard-state.mjs").GuardState} state */
export function checkPeakHours(state) {
  const now = new Date(state.now);
  const weekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
  if (!weekday) return null;
  const hour = now.getUTCHours();
  const window = PEAK_WINDOWS_UTC.find((each) => hour >= each.startHour && hour < each.endHour);
  if (window === undefined) return null;
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const offPeakAt = new Date(dayStart + window.endHour * HOUR_MS).toISOString();
  return {
    rule: "peak", overridable: true,
    why: `it is ${now.toISOString()}, a weekday inside the ${hh(window.startHour)}-${hh(window.endHour)} UTC peak window, when the provider's peak pricing halves what a run's budget buys`,
    remedy: `Launch at or after ${offPeakAt}, the next off-peak start (peak windows: weekdays 01:00-04:00 and 06:00-10:00 UTC). Or ask the user to create ${state.files.override("peak")}.`,
  };
}

/** @param {number} hour */
function hh(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}
