import { AttemptProofStuck, AttemptScriptRefused, readThreadAttempts, type AttemptOutcomeRead, type AttemptOutcomeRecord, type AttemptReadControl } from "./attempt/index.js";

/** The statuses an attempt always stops on. */
const ENDINGS: ReadonlySet<AttemptOutcomeRecord["status"]> = new Set(["achieved", "finished_unchecked", "budget_out", "stopped_by_person"]);

/** Core's word for a wait on the person's answer to a permission question (`AutomationStudioTaskAttempt.waitingFor`). */
const PERMISSION_WAIT = "permission";

/**
 * `waiting_for_person` is not an ending to Core: its wait has no deadline and a person's Continue ends it. It is
 * where a proof with no person playing stops and says so, and a wait to follow through where the Lab plays one.
 *
 * **Which waits the Lab plays is by what is awaited (t897).** A permission question is answered by the Lab's person
 * on every run that answers them, whether or not the scenario declares a person for its checks, so a wait for one is
 * followed on. Run `run-mwb5cnxg-003415b4` stopped here on the second and fourth attempts: each saved Flow's run asks
 * once before it starts, the Lab answered in the chat within 1.3 s, and a poll that landed in that window read the
 * wait as where the proof stops. It then read a row mid-run (working, one live step) and took the answer turn before
 * Core wrote it, so both attempts read as ended with no answer while Core went on and answered them.
 */
function stopsOn(attempt: AttemptOutcomeRecord, plays: { person: boolean; permissions: boolean }): boolean {
  if (ENDINGS.has(attempt.status)) return true;
  if (attempt.status !== "waiting_for_person") return false;
  return !(plays.person || (plays.permissions && attempt.waitingFor === PERMISSION_WAIT));
}

/** Nothing moved for this long: no new read of the attempt differs, no new call. It stops the proof and says where it stood; it never calls an attempt a failure. */
const DEFAULT_STALL_MS = 10 * 60_000;
const POLL_MS = 1_000;

export type FollowAttemptInput = {
  control: AttemptReadControl;
  projectId: string;
  conversationId: string;
  /** Attempts this thread already held, whose ids are not this one's. */
  known: ReadonlySet<string>;
  /**
   * What moves besides the record: the steps Core has logged, the model calls so far,
   * and a request the script refused. It matters, because a thread holds no attempt until
   * its first round has ended, so the record alone says nothing of a long first round.
   */
  progress?: () => Promise<{ marker: string; refused?: string }>;
  /** The Lab is playing the scenario's declared person, so an attempt waiting for a person is waiting for it and is followed on. */
  personPlaying?: boolean;
  /** The Lab's person answers each permission question as it comes, so an attempt waiting on one is followed on (`stopsOn`). */
  permissionsAnswered?: boolean;
  /** What a stuck proof says it last saw of the chat. */
  describeChat?: () => Promise<string>;
  onChange?: (line: string) => void;
  stallMs?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

function spoken(attempt: AttemptOutcomeRecord): string {
  const waiting = attempt.waitingFor ? ` for ${attempt.waitingFor}` : "";
  return `${attempt.status}${waiting}, ${attempt.liveSteps} live steps, ${attempt.spend.calls} calls`;
}

/**
 * Watches a thread until the attempt its message started stops on an ending, however
 * long that takes. There is no build deadline here, because a running attempt is not a
 * failure: only a stretch with nothing moving at all stops the watch, and it reports
 * where it stood instead of judging. A failed read is waited through, since a blip is
 * not an ending; a stretch of them is what `stallMs` is for.
 */
export async function followAttempt(input: FollowAttemptInput): Promise<AttemptOutcomeRead> {
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const stallMs = input.stallMs ?? DEFAULT_STALL_MS;
  let movedAt = now();
  let last = "";
  let current: AttemptOutcomeRead | undefined;
  let readFailure: string | undefined;
  for (;;) {
    const progress = await input.progress?.();
    if (progress?.refused) throw new AttemptScriptRefused(progress.refused);
    try {
      const outcomes = await readThreadAttempts(input.control, input.projectId, input.conversationId);
      current = outcomes.find((outcome) => !input.known.has(outcome.attempt.attemptId)) ?? current;
      readFailure = undefined;
    } catch (error) {
      readFailure = error instanceof Error ? error.message : String(error);
    }
    if (current && stopsOn(current.attempt, { person: input.personPlaying === true, permissions: input.permissionsAnswered === true })) return current;
    const seen = `${current ? spoken(current.attempt) : "no attempt yet"} | ${progress?.marker ?? ""}`;
    if (seen !== last) {
      last = seen;
      movedAt = now();
      input.onChange?.(seen);
    }
    if (now() - movedAt >= stallMs) {
      const chat = await input.describeChat?.().catch((error: unknown) => `(the chat could not be read: ${error instanceof Error ? error.message : String(error)})`);
      const stood = current ? `the attempt stood at ${spoken(current.attempt)}` : "the message started no attempt the thread can read";
      throw new AttemptProofStuck(`${stood}, nothing moved for ${Math.round(stallMs / 1000)} s${readFailure ? `, and the last read failed: ${readFailure}` : ""}${chat ? `. The chat showed: ${JSON.stringify(chat.slice(-800))}` : ""}`, current?.attempt ?? null);
    }
    await sleep(input.pollMs ?? POLL_MS);
  }
}
