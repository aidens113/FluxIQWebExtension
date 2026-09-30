/**
 * How much of FluxIQ's work the background keeps for the chat's step
 * messages (`background/activity/unit-history.ts`): the last `units` units of
 * work, and at most `eventsPerUnit` events of each, the newest. A build of 60
 * decisions is about 250 kept events, so a whole build fits with room to
 * spare; the bound is there so a runaway loop cannot grow the panel's state
 * without end.
 */
export const ACTIVITY_HISTORY_LIMITS = { units: 10, eventsPerUnit: 500 } as const;
