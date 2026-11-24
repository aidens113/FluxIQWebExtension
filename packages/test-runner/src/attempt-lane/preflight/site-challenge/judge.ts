/** Everything one site-challenge stage observed, as closed words and counts: nothing a page showed. */
export type SiteChallengeObservation = Readonly<{
  /** The id of the declared check that showed on the page before the run began, `null` when none did. */
  armedCheck: string | null;
  /** The site's own rows say a run meets this check only through a person (a required hand-off). */
  personRequired: boolean;
  /** A person-needed ask stood on the thread while the check was still on the page. */
  askOnThread: boolean;
  /** The extension's chat showed that ask to the person. */
  askInChat: boolean;
  /** What the Lab's person did at the ask, `null` when it never saw one. */
  handOff: Readonly<{ did: string; cleared: boolean; answer: string | null; via: string | null; check: string | null; note: string | null }> | null;
  /** The check lifted before any ask was raised and before the Lab's person did anything: the site clears it by itself. */
  clearedItself: boolean;
  /** What the run did after the check was passed or lifted. */
  after: Readonly<{ readSucceeded: boolean; checkGone: boolean }> | null;
  /** A stage error that stopped the observing, as a closed code. */
  stageError: string | null;
}>;

/**
 * `how` says what let the run go on: `person` is the Lab's person passing the check the product handed over; `waited_out`
 * is a check the site lifts by itself, which the product waited out without asking a person and without touching it.
 */
export type SiteChallengeVerdict = Readonly<{ siteChallenge: "passed" | "failed"; stage: "arm" | "hand_off" | "person_pass" | "continue"; code: string | null; how: "person" | "waited_out" | null }>;

/** The first stage that did not hold names the failure; a pass needs every one. */
export function judgeSiteChallenge(observation: SiteChallengeObservation): SiteChallengeVerdict {
  const failed = (stage: SiteChallengeVerdict["stage"], code: string): SiteChallengeVerdict => ({ siteChallenge: "failed", stage, code, how: null });
  if (observation.armedCheck === null) return failed("arm", observation.stageError ?? "declared_check_not_shown");
  if (!observation.askOnThread) {
    // A check the site lifts by itself needs no person; one a row says needs a person must never lift without one.
    if (observation.clearedItself && observation.personRequired) return failed("hand_off", "required_person_check_cleared_without_a_person");
    if (observation.clearedItself) return afterTheCheck(observation, "waited_out", failed);
    return failed("hand_off", observation.stageError ?? "no_person_ask_on_thread");
  }
  if (!observation.askInChat) return failed("hand_off", "ask_not_shown_in_chat");
  const { handOff } = observation;
  if (!handOff) return failed("person_pass", observation.stageError ?? "no_hand_off_recorded");
  if (handOff.did === "declined-tampered") return failed("person_pass", "product_touched_the_check_before_the_person");
  if (!handOff.cleared) return failed("person_pass", `person_${handOff.did}`);
  if (handOff.answer !== "person_done") return failed("person_pass", "answer_did_not_reach_core");
  if (handOff.via !== "chat") return failed("person_pass", "answer_not_given_in_chat");
  return afterTheCheck(observation, "person", failed);
}

function afterTheCheck(observation: SiteChallengeObservation, how: "person" | "waited_out", failed: (stage: SiteChallengeVerdict["stage"], code: string) => SiteChallengeVerdict): SiteChallengeVerdict {
  if (!observation.after) return failed("continue", observation.stageError ?? "run_did_not_continue");
  if (!observation.after.readSucceeded) return failed("continue", "read_after_the_check_failed");
  if (!observation.after.checkGone) return failed("continue", "check_still_on_the_page");
  return { siteChallenge: "passed", stage: "continue", code: null, how };
}
