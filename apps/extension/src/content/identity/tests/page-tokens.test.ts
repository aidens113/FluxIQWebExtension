// An id or selector token that no element on the current page carries is
// evidence of nothing (`../page-tokens.ts`, `../score.ts`).
//
// The first rows rebuild R4a (`run-mv2nlh9l-52e476da`). The crossborder item
// page (`apps/scenario-lab/src/scenarios/crossborder-marketplace/markup/item.ts`)
// renders its quantity box as `<input class="<build hash>" id="<rotatingId>">`
// under a "Quantity" heading, with no `name`, no test id and no `<label for>`,
// and `rotatingId` draws `fb` and an FNV hash afresh on every load. Exploration
// recorded the box as `#fb1l6ufkg`; the trial's reset drew `fb8y7yz1`. The
// shape rule does not judge `fb1l6ufkg` generated, so the stale id reached Core
// as a contradiction and the step failed `web.target.not_found` at 0.27.
//
// The page here is a stand-in that answers the two questions `page-tokens.ts`
// asks -- an id lookup and an attribute query -- from the ids and attributes
// it is told the page holds, and has no shadow roots. Which signals Core then
// compares is what is under test; Core's scoring is its own.

import assert from "node:assert/strict";
import test from "node:test";
import type { TargetCandidate } from "../candidates";
import { TARGET_SCORE_FLOOR, scoreTargetCandidate, scoreTargetCandidates, type RecordedIdentity } from "../score";
import { isVolatileIdentifier } from "../../selector";

type PageAttributes = { ids?: readonly string[]; attributes?: ReadonlyArray<readonly [string, string]> };

/** A document that holds exactly the ids and attributes named, and answers the lookups `page-tokens.ts` makes. */
function stubPage({ ids = [], attributes = [] }: PageAttributes): Document {
  const held = new Set(ids);
  return {
    getElementById: (id: string) => (held.has(id) ? {} : null),
    querySelector: (selector: string) => {
      const match = /^\[([\w-]+)="((?:\\.|[^"\\])*)"\]$/u.exec(selector);
      if (!match) throw new Error(`unexpected query ${selector}`);
      const value = (match[2] ?? "").replace(/\\(.)/gu, "$1");
      return attributes.some(([name, held]) => name === match[1] && held === value) ? {} : null;
    },
    querySelectorAll: () => []
  } as unknown as Document;
}

/** A candidate on `page`; `score.ts` reads its element only to ask the page, and hands it back by identity. */
function candidate(page: Document | undefined, candidateId: string, fingerprint: Omit<TargetCandidate["fingerprint"], "candidateId">): TargetCandidate {
  return { element: { candidateId, ownerDocument: page } as unknown as Element, fingerprint: { candidateId, ...fingerprint } };
}

function chosenId(selection: ReturnType<typeof scoreTargetCandidates>): string | undefined {
  return selection.outcome === "resolved" ? (selection.chosen.element as unknown as { candidateId: string }).candidateId : undefined;
}

const QTY_CLASS = "css-1q8tz0a";
const SEARCH_CLASS = "css-0w7hf3k";

/** The quantity box as exploration recorded it, on the load that drew `fb1l6ufkg`. */
const RECORDED_QUANTITY: RecordedIdentity = {
  tagName: "input",
  implicitRole: "textbox",
  id: "fb1l6ufkg",
  selector: "#fb1l6ufkg",
  classNames: [QTY_CLASS],
  label: "Quantity"
};

/** The trial's page after its reset: the same three text boxes, every rotating id drawn again. */
const TRIAL_IDS = ["fb8y7yz1", "fb2c0mhq4"];

function trialPool(page: Document | undefined): TargetCandidate[] {
  return [
    candidate(page, "search", {
      tagName: "input", role: "textbox", id: "fb2c0mhq4", selector: "#fb2c0mhq4", classNames: [SEARCH_CLASS],
      accessibleName: "Autumn Mega Sale: up to 70% off", isVisibleOnViewport: true
    }),
    candidate(page, "quantity", {
      tagName: "input", role: "textbox", id: "fb8y7yz1", selector: "#fb8y7yz1", classNames: [QTY_CLASS],
      label: "Quantity", isVisibleOnViewport: true
    }),
    candidate(page, "message", {
      tagName: "input", role: "textbox", accessibleName: "Type a message…", isVisibleOnViewport: true
    })
  ];
}

test("R4a: the shape rule lets the stale id through, which is why the page has to be asked", () => {
  assert.equal(isVolatileIdentifier("fb1l6ufkg"), false);
  assert.equal(isVolatileIdentifier("fb8y7yz1"), true);
});

test("R4a: without asking the page, the stale id contradicts the quantity box and buries it under the floor", () => {
  // A page that cannot be asked keeps today's meaning, which is the run's.
  const selection = scoreTargetCandidates(RECORDED_QUANTITY, trialPool(undefined));
  assert.equal(selection.outcome, "unmatched");
  assert.ok((selection.ranked[0]?.score.normalizedScore ?? 1) < TARGET_SCORE_FLOOR, `best scored ${selection.ranked[0]?.score.normalizedScore}`);
  assert.equal(selection.dropped, undefined);
});

test("R4a: an id whose element changed between capture and replay is found by its other signals", () => {
  const page = stubPage({ ids: TRIAL_IDS });
  const selection = scoreTargetCandidates(RECORDED_QUANTITY, trialPool(page));
  assert.equal(selection.outcome, "resolved", `ranked ${selection.ranked.map((entry) => entry.score.normalizedScore.toFixed(3)).join(", ")}`);
  assert.equal(chosenId(selection), "quantity");
  // Neither the id nor the selector quoting it was compared: nothing on the page carries the token.
  const chosen = selection.outcome === "resolved" ? selection.chosen.score : undefined;
  const compared = [...(chosen?.positiveContributions ?? []), ...(chosen?.negativeContributions ?? [])].map((entry) => entry.signalPath);
  assert.ok(!compared.includes("id") && !compared.includes("selector"), `compared ${compared.join(", ")}`);
  // And the measurement says what was set aside, and why.
  assert.deepEqual(selection.dropped, [
    { signal: "id", token: "fb1l6ufkg", because: "absent" },
    { signal: "selector", token: "#fb1l6ufkg", because: "absent" }
  ]);
});

test("a real id still on the page is compared, and the element that carries it wins", () => {
  const recorded: RecordedIdentity = { tagName: "input", implicitRole: "textbox", id: "quantity", selector: "#quantity", classNames: [QTY_CLASS], label: "Quantity" };
  const page = stubPage({ ids: ["quantity", "quantity-gift"] });
  const pool = [
    candidate(page, "gift", { tagName: "input", role: "textbox", id: "quantity-gift", selector: "#quantity-gift", classNames: [QTY_CLASS], label: "Quantity", isVisibleOnViewport: true }),
    candidate(page, "main", { tagName: "input", role: "textbox", id: "quantity", selector: "#quantity", classNames: [QTY_CLASS], label: "Quantity", isVisibleOnViewport: true })
  ];
  const selection = scoreTargetCandidates(recorded, pool);
  assert.equal(chosenId(selection), "main");
  assert.equal(selection.dropped, undefined);
  const runnerUp = selection.outcome === "resolved" ? selection.runnerUp : undefined;
  assert.ok(runnerUp?.score.negativeContributions.some((entry) => entry.signalPath === "id"), "the twin with another id is contradicted by it");
});

test("a token another element on the page carries still contradicts a candidate that does not", () => {
  // The recorded id now names a different element -- one outside the family,
  // so it is not in the pool -- and the candidate that reads like the recording
  // carries another id. The page has named something by the token, so it is
  // evidence, and against this candidate.
  const recorded: RecordedIdentity = { tagName: "button", implicitRole: "button", id: "save", visibleText: "Save" };
  const lookalike = (page: Document) => candidate(page, "lookalike", { tagName: "button", role: "button", id: "save-draft", selector: "#save-draft", visibleText: "Save", isVisibleOnViewport: true });

  const carried = scoreTargetCandidate(recorded, lookalike(stubPage({ ids: ["save", "save-draft"] })));
  const absent = scoreTargetCandidate(recorded, lookalike(stubPage({ ids: ["save-draft"] })));
  assert.ok(carried && absent);
  assert.ok(carried.negativeContributions.some((entry) => entry.signalPath === "id"), "carried elsewhere, the id contradicts");
  assert.ok(!absent.negativeContributions.some((entry) => entry.signalPath === "id"), "carried nowhere, the id says nothing");
  assert.ok(carried.normalizedScore < absent.normalizedScore);
});

test("a selector is set aside by any identifier it quotes that the page no longer holds, and kept while every one is held", () => {
  const recorded: RecordedIdentity = { tagName: "input", implicitRole: "textbox", selector: '[data-testid="qty"] > input', label: "Quantity" };
  const box = (page: Document) => [candidate(page, "box", { tagName: "input", role: "textbox", label: "Quantity", isVisibleOnViewport: true })];

  const gone = scoreTargetCandidates(recorded, box(stubPage({})));
  assert.deepEqual(gone.dropped, [{ signal: "selector", token: '[data-testid="qty"]', because: "absent" }]);

  const held = scoreTargetCandidates(recorded, box(stubPage({ attributes: [["data-testid", "qty"]] })));
  assert.equal(held.dropped, undefined);
  const best = held.ranked[0]?.score;
  assert.ok([...(best?.positiveContributions ?? []), ...(best?.negativeContributions ?? [])].some((entry) => entry.signalPath === "selector"), "the held selector is compared");
});

test("the shape rule still runs first: a generated id no candidate carries is set aside without asking the page", () => {
  let asked = 0;
  const getElementById = (): object => {
    asked += 1;
    return {};
  };
  const page = { ...stubPage({ ids: [":r13b8o:"] }), getElementById } as unknown as Document;
  const selection = scoreTargetCandidates(
    { tagName: "button", implicitRole: "button", id: ":r13b8o:", visibleText: "Save" },
    [candidate(page, "save", { tagName: "button", role: "button", visibleText: "Save", isVisibleOnViewport: true })]
  );
  assert.equal(asked, 0);
  assert.deepEqual(selection.dropped, [{ signal: "id", token: ":r13b8o:", because: "generated" }]);
});
