// Whether the shell should show the Chat tab because a run just started, so
// the person watches each step live wherever the run came from: the
// Automations strip's Run, the chat's "run it", or a run started over the API
// (the Lab's playback, FluxIQ's own app). Pure, so every rule is tested
// without a DOM; `mount-panel.ts` feeds it the shell's own activity feed.
//
//   - Only runs (`subject.kind` "run"). A build started from the chat is on
//     the Chat tab already, and a build started elsewhere is a long piece of
//     work the person may be configuring around, so it never moves the panel.
//   - Only the panel's chosen project, when it has one (the same scope the
//     chat's Stop control uses).
//   - Once per run: the first event of a new `activityId` decides. Every later
//     event of the same run leaves the tab alone, so a person who goes back to
//     Automations during a run is not pulled back.
//   - Never while a recording runs or is paused: the recording owns the panel,
//     and that run is then left alone for good.
//   - Not while the person types in a field the switch would hide: the switch
//     waits, and happens on a later event of the same run once they stop.
//   - Never for a run's last event: a run that already ended is not followed.

import type { ClientGatewayActivity } from "../../shared/activity/index";

/** What the shell knows when the activity changes. */
export type RunFollowInput = {
  /** The latest activity event, or null. */
  readonly current: ClientGatewayActivity | null;
  /** The panel's chosen project; undefined follows runs of any project. */
  readonly projectId: string | undefined;
  /** A recording runs or is paused. */
  readonly recording: boolean;
  /** The person is typing in a field the switch to Chat would hide. */
  readonly typing: boolean;
};

export type RunFollow = {
  /** True exactly when the shell should switch to the Chat tab now. */
  observe(input: RunFollowInput): boolean;
};

/** How many run ids are remembered as already decided. */
const REMEMBERED = 64;

/** Creates the follower. One per mounted panel. */
export function createRunFollow(): RunFollow {
  const decided: string[] = [];
  let waiting: string | undefined;
  return {
    observe({ current, projectId, recording, typing }) {
      if (current === null || current.subject.kind !== "run") { waiting = undefined; return false; }
      const id = current.activityId;
      if (decided.includes(id)) {
        if (waiting !== id) return false;
        if (current.final === true || recording) { waiting = undefined; return false; }
        if (typing) return false;
        waiting = undefined;
        return true;
      }
      decided.push(id);
      if (decided.length > REMEMBERED) decided.shift();
      waiting = undefined;
      if (projectId !== undefined && current.subject.projectId !== projectId) return false;
      if (current.final === true || recording) return false;
      if (typing) { waiting = id; return false; }
      return true;
    }
  };
}
