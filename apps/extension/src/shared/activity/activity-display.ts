import type { ClientGatewayActivityPhase } from "@fluxiq/client-gateway-websocket";

/**
 * The status a person sees, paced from Core's raw events by the background
 * (`background/activity/`). The overlay and the chat header render this and
 * nothing else, so both show the same words and neither can flicker faster
 * than the pacer lets it.
 *
 * - `headline` names the unit of work and stays put while it runs ("Building
 *   your Flow", "Running your Flow", "Fixing your Flow" once Core repairs
 *   it); it changes only when the work changes, settles ("Flow ready", "Build
 *   failed", "Run finished", "Run failed", "Couldn't fix your Flow") or needs
 *   the person ("Waiting for you: finish the check on the page", "Waiting for
 *   you: answer in the FluxIQ panel"). Those changes show at once
 *   (`background/activity/headline.ts`).
 * - `detail` is Core's latest event in a person's words (`activityWording`),
 *   never a tool id or result code, changed at most once per 1,200 ms; the
 *   newest always shows once the interval ends. It is null rather than a
 *   repeat of the headline (`isHeadlineEcho`).
 * - `phase` and `step` are the phase and step of the event `detail` came
 *   from, so they change no faster than `detail` does.
 *
 * The background sends it on at most four times a second, and only when it
 * changed (`background/activity/activity-relay.ts`).
 */
export type ActivityDisplay = {
  /** `${subject.kind}:${subject.id}` of the unit of work, as in `ClientGatewayActivity.activityId`. */
  activityId: string;
  subjectKind: "build" | "run";
  phase: ClientGatewayActivityPhase;
  headline: string;
  detail: string | null;
  /** 1-based step of M, from the run's step events; kept between them, null for a build and once settled. */
  step: { index: number; count: number } | null;
  /** True while the work runs; false once it settled or while it waits for the person (`outcome` says which). */
  working: boolean;
  /** Null while working; otherwise done, failed, or waiting for the person (which is not final: work may resume). */
  outcome: "done" | "failed" | "waiting" | null;
  /** The Core sequence of the newest event folded into this display. */
  sequence: number;
};
