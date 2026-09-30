import type { ScenarioPersonChecks } from "@fluxiq-web-extension/test-contracts";
import { robotCode } from "./state/index.js";

/**
 * The store's hard challenge, as a person passes it: read the six characters
 * off the image, type them into "Type characters" and press Continue shopping.
 *
 * Only a person can read the image, so the Lab reads it the way the fixture
 * drew it: from the store's challenge seed and the image number in its state.
 * A person never presses "Try different image" -- the first image is always
 * readable -- so no step here does.
 *
 * `first-page-earbuds/robot-check` answers every page with this check, the
 * home page included, so every honest path meets it and the run must hand
 * off: it is `required`. With the check passed the store is itself again, and
 * the run is judged by the row's own expectations.
 *
 * A check that already shows a wrong answer or a later image has had the
 * automation's hand on it -- a guess typed, a new image asked for -- which is
 * exactly what the hand-off exists to prevent, so the person declines there.
 */
export const PERSON_CHECKS: ScenarioPersonChecks = Object.freeze({
  scenarioId: "everything-store",
  checks: Object.freeze([
    Object.freeze({
      id: "type-the-characters",
      description: "Enter the characters you see below: a canvas image of six characters, a box to type them into, and Continue shopping.",
      shows: "Enter the characters you see below",
      steps: Object.freeze([
        Object.freeze({ action: "type-answer" as const, label: "Type characters" }),
        Object.freeze({ action: "press" as const, button: "Continue shopping" }),
      ]),
      clears: "navigation" as const,
      clearsWithinMs: 8_000,
    }),
  ]),
  handOffs: Object.freeze([
    Object.freeze({
      workflowId: "first-page-earbuds",
      variantId: "robot-check",
      person: "completes" as const,
      required: true,
      because: "The store answers every page, the home page included, with its type-the-characters check until a person passes it.",
    }),
  ]),
  answer: (state: unknown) => {
    const robot = robotState(state);
    return robotCode(robot.seed, robot.image);
  },
  tampered: (state: unknown) => {
    const robot = robotState(state);
    if (robot.wrong > 0) return `${robot.wrong} wrong answer(s) were typed into the check before the person came`;
    if (robot.image > 0) return "a different image was asked for before the person came";
    return null;
  },
});

/** The challenge's seed and image, and how many wrong answers it has had, from the store's state as `/__control/final-state` returns it. */
function robotState(state: unknown): { seed: number; image: number; wrong: number } {
  const store = state as { challengeSeed?: unknown; guard?: { robot?: { image?: unknown; wrong?: unknown } } } | null;
  const seed = store?.challengeSeed;
  const robot = store?.guard?.robot;
  if (typeof seed !== "number" || typeof robot?.image !== "number" || typeof robot.wrong !== "number") throw new Error("The everything store's state holds no robot check");
  return { seed, image: robot.image, wrong: robot.wrong };
}
