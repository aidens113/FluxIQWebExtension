// The story of each recent unit of work, as the chat tells it: every decision
// Core explains (a `thought` with its reason), every check and repair, every
// action's start and end, every run step, and the event that ends the unit.
// The relay's `recent` keeps only the last 60 events of every kind, so a long
// build's first decisions fell out of it; this keeps the whole unit, bounded
// (`ACTIVITY_HISTORY_LIMITS`): the last few units of work, each at most so
// many events, the newest kept.
//
// Left out: a pure status change (no `detail` and not final), a decision
// that has not been explained yet ("Deciding the next step", which has no
// text: the live line says it), and Core's own bookkeeping (`isInternalStep`).
// Kept in the order the relay accepted them, which is Core's order within a
// session and arrival order across a Core restart, when sequences begin again.
//
// It does not touch the pacer or the overlay: the paced display is made from
// every event, kept or not, exactly as before.

import { ACTIVITY_HISTORY_LIMITS, isInternalStep, type ClientGatewayActivity } from "../../shared/activity/index";

type Kept = { order: number; event: ClientGatewayActivity };

export class UnitHistory {
  /** Each unit's kept events; the unit heard from last is last. */
  private readonly units = new Map<string, Kept[]>();
  private order = 0;
  private flat: ClientGatewayActivity[] = [];

  constructor(private readonly limits: { units: number; eventsPerUnit: number } = ACTIVITY_HISTORY_LIMITS) {}

  /** Takes one accepted event. Returns whether it is part of the story. */
  accept(event: ClientGatewayActivity): boolean {
    if (!tellsTheStory(event)) return false;
    const kept = this.units.get(event.activityId) ?? [];
    this.units.delete(event.activityId);
    this.order += 1;
    kept.push({ order: this.order, event });
    if (kept.length > this.limits.eventsPerUnit) kept.splice(0, kept.length - this.limits.eventsPerUnit);
    this.units.set(event.activityId, kept);
    while (this.units.size > this.limits.units) {
      const oldest = this.units.keys().next().value;
      if (oldest === undefined) break;
      this.units.delete(oldest);
    }
    this.flat = [...this.units.values()].flat().sort((a, b) => a.order - b.order).map((entry) => entry.event);
    return true;
  }

  /** The kept events of every unit, in the order they were accepted. */
  events(): ClientGatewayActivity[] {
    return [...this.flat];
  }
}

function tellsTheStory(event: ClientGatewayActivity): boolean {
  // What the person asked the work, in their own words: the chat shows it as their message.
  if (typeof event.request === "string" && event.request.trim() !== "") return true;
  const detail = event.detail;
  if (detail === undefined) return event.final === true;
  if (isInternalStep(detail)) return false;
  if (detail.kind === "thought") return (detail.text?.trim() ?? "") !== "";
  return true;
}
