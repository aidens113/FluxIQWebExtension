// The watches the click verb starts around a press, faked so each test states
// what they saw and records how the verb used them (`actions/tests/click.test.ts`).
// Moved out of `click.test.ts` on 2026-10-20, unchanged.

import type { InPlaceEffect, InPlaceEffectWatch, PressSignal, RateLimitNotice, RobotCheckSighting } from "../../../action-runtime";
import type { ContentActionDependencies } from "../../types";

export type WatchRecord = { made: number; settledWith: number[]; stopped: number };

/** An in-place watch that reports `effect` when settled, and records how the verb used it. */
export function fakeWatch(effect: InPlaceEffect | undefined, events: string[]): { make: (link: Element) => InPlaceEffectWatch; record: WatchRecord } {
  const record: WatchRecord = { made: 0, settledWith: [], stopped: 0 };
  return {
    record,
    make: () => {
      events.push("watch");
      record.made += 1;
      return {
        settle: async (timeoutMs) => {
          record.settledWith.push(timeoutMs);
          return effect;
        },
        stop: () => {
          record.stopped += 1;
        }
      };
    }
  };
}

export type NoticeRecord = { made: number; settledWith: number[]; stopped: number; refusedWith: RateLimitNotice[]; refusedByPageWith: RateLimitNotice[] };

/** A rate-limit watch that reports `notice` when settled (`later` for a press made once more), and records how the verb used it. */
export function fakeNoticeWatch(
  notice: RateLimitNotice | undefined,
  events: string[],
  later?: RateLimitNotice
): { make: ContentActionDependencies["watchRateLimitNotice"]; record: NoticeRecord } {
  const record: NoticeRecord = { made: 0, settledWith: [], stopped: 0, refusedWith: [], refusedByPageWith: [] };
  return {
    record,
    make: () => {
      events.push("notice-watch");
      record.made += 1;
      const answer = record.made === 1 ? notice : later;
      return {
        settle: async (windowMs) => {
          record.settledWith.push(windowMs);
          return answer;
        },
        stop: () => {
          record.stopped += 1;
        }
      };
    }
  };
}

export type CheckRecord = { made: number; settledWith: Array<[number, number]>; stopped: number; handedOver: RobotCheckSighting[] };

/** A robot-check watch that reports `sighting` when settled, and records how the verb used it. */
export function fakeCheckWatch(sighting: RobotCheckSighting | undefined, events: string[]): { make: ContentActionDependencies["watchRobotCheck"]; record: CheckRecord } {
  const record: CheckRecord = { made: 0, settledWith: [], stopped: 0, handedOver: [] };
  return {
    record,
    make: () => {
      events.push("check-watch");
      record.made += 1;
      return {
        settle: async (windowMs, waitMs) => {
          record.settledWith.push([windowMs, waitMs]);
          return sighting;
        },
        stop: () => {
          record.stopped += 1;
        }
      };
    }
  };
}

export type IgnoredRecord = { made: number; settledWith: number[]; stopped: number };

/**
 * An ignored-press watch that reports `seen` when the first press's watch is
 * settled and `secondSeen` for the press made once more, and records how the
 * verb used it.
 */
export function fakeIgnoredWatch(
  firstSeen: PressSignal[],
  events: string[],
  secondSeen: PressSignal[] = ["change"],
  settledUnchanged: boolean | "announced" = false
): { make: ContentActionDependencies["watchIgnoredPress"]; record: IgnoredRecord; unchangedAsked: number[] } {
  const record: IgnoredRecord = { made: 0, settledWith: [], stopped: 0 };
  // The windows each press's settled look was asked to wait (t517); it answers `settledUnchanged`.
  const unchangedAsked: number[] = [];
  return {
    record,
    unchangedAsked,
    make: () => {
      events.push("ignored-watch");
      record.made += 1;
      const seen = record.made === 1 ? firstSeen : secondSeen;
      return {
        settle: async (windowMs) => {
          record.settledWith.push(windowMs);
          return { seen: [...seen], afterMs: seen.length > 0 ? 4 : windowMs };
        },
        settleUnchanged: async (windowMs) => {
          unchangedAsked.push(windowMs);
          return settledUnchanged;
        },
        stop: () => {
          record.stopped += 1;
        }
      };
    }
  };
}
