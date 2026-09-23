import { escapeHtml, fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

export type DynamicListItem = { id: string; label: string };

/**
 * `visit` is how many times this list has been loaded afresh, and it is what
 * the adversarial variant arms.
 *
 * A real listing does not hand back the same rows in the same order with the
 * same identifiers every time somebody opens it: rows arrive, rows leave, and
 * the ids behind them are per-visit. A recording taken on one visit therefore
 * names a control by something the next visit has renumbered, and the only
 * thing that still identifies the row is what a person would use -- the text
 * in it.
 */
export type DynamicListState = { nextId: number; items: DynamicListItem[]; visit: number };

/** The rows a second visit finds already there, ahead of the ones the recording saw. */
const ARRIVED_SINCE_LAST_VISIT = ["Arrived overnight", "Arrived this morning"];

export const dynamicListScenario = defineScenario<DynamicListState>({
  id: "dynamic-list",
  title: "Dynamic list",
  startPath: "/scenarios/dynamic-list/",
  seed: 102,
  manifest: createScenarioManifest({
    id: "dynamic-list", title: "Dynamic list", tags: ["mutation", "identity"], seed: 102,
    startPath: "/scenarios/dynamic-list/", capabilities: ["forms", "mutation"],
    recordingScript: [
      { id: "enter-item", operation: "type", target: "testid:item-label", value: "Fourth" },
      { id: "add-item", operation: "click", target: "role:button[name=Add]" },
      { id: "reverse", operation: "click", target: "testid:reverse" },
      { id: "list-settled", operation: "waitForState", target: "testid:item-count", timeoutMs: 1000 },
      { id: "final-list", operation: "checkpoint" },
    ],
    expected: {
      pageFacts: [{ id: "initial-count", subject: "item-count", predicate: "text", value: "3 items" }],
      recordingEvents: [{ type: "web.dom.mutated" }],
      actions: [{ action: "web.dom.type", outcome: "succeeded" }, { action: "web.dom.click", outcome: "succeeded" }],
      finalState: [{ id: "four-items", subject: "item-count", predicate: "text", value: "4 items" }],
    },
  workflows: [{
    id: "remove-a-row",
    description: "Remove one named row from the list, by the Remove button that sits in it.",
    recordingScript: [
      { id: "remove-second", operation: "click", target: 'li:has-text("Seed 102 item 2") button' },
      { id: "list-settled", operation: "waitForState", target: "testid:item-count", timeoutMs: 1000 },
      { id: "row-removed", operation: "checkpoint" },
    ],
    expected: {
      recordingEvents: [{ type: "web.element.clicked", count: 1 }, { type: "web.dom.mutated" }],
      actions: [{ action: "web.dom.click", outcome: "succeeded" }],
      finalState: [{ id: "two-items", subject: "item-count", predicate: "text", value: "2 items" }],
    },
    variants: [{
      id: "rows-per-visit",
      description: "The list as a second visit finds it: two rows have arrived above the recorded one and every row's identifier has been reissued, so the recorded row is in a different place under a different id and only its text still names it.",
      arm: { operation: "revisit" },
      /**
       * Measured, not assumed. This row was written expecting the host to
       * recover the recorded row by the text in it, and it does not:
       * `run-mudjlm0l-b9212e40` resolved by `fingerprint` against seven
       * candidates on all three attempts and refused every one, ending
       * `web.target.not_found` with five rows still on the page.
       *
       * The refusal is the resolver's record rule doing its job rather than
       * failing at it. Every Remove button on this page is byte-identical, so
       * the only thing that tells one from another is the row it sits in, and
       * the rule refuses a candidate in a row the recording did not name
       * (`content/action-runtime/resolve-target.ts`). Reissuing the row
       * identifiers takes that away, and refusing is the safe answer: the
       * alternative is pressing Remove on somebody else's row.
       *
       * So this condition measures the boundary of the recovery rather than
       * the recovery. A listing that reorders rows while keeping their
       * identifiers is the case that should be absorbed, and it wants a
       * sibling variant that changes the order alone.
       */
      expected: {
        actions: [{ action: "web.dom.click", outcome: "failed" }],
        finalState: [{ id: "five-items-left", subject: "item-count", predicate: "text", value: "5 items" }],
        failure: { category: "target_not_found", code: "web.target.not_found" },
        recovery: {
          absorbedBy: "none",
          because: "Every Remove button reads the same, so the row identifies it; the identifiers were reissued, and the resolver refuses a candidate in a row the recording did not name.",
        },
      },
    }],
  }],
  }),
  createState(seed) {
    const firstId = (Math.abs(seed) % 9000) + 1000;
    return {
      nextId: firstId + 3,
      visit: 1,
      items: [0, 1, 2].map(index => ({ id: `item-${firstId + index}`, label: `Seed ${seed} item ${index + 1}` })),
    };
  },
  mutate(state, operation, payload) {
    if (operation === "add") {
      const label = readLabel(payload) || `Item ${state.nextId}`;
      return { ...state, nextId: state.nextId + 1, items: [...state.items, { id: `item-${state.nextId}`, label }] };
    }
    if (operation === "reverse") return { ...state, items: [...state.items].reverse() };
    // The second visit: rows that arrived while nobody was looking, above the
    // ones the recording saw, and a fresh identifier on every row including
    // the ones that did not move. Labels are untouched, because a row's text
    // is what a person -- and a recording's fingerprint -- knows it by.
    if (operation === "revisit") {
      const visit = state.visit + 1;
      const arrived = ARRIVED_SINCE_LAST_VISIT.map((label, index) => ({ id: `item-v${visit}-${state.nextId + index}`, label }));
      const renumbered = state.items.map((item, index) => ({ ...item, id: `item-v${visit}-${state.nextId + arrived.length + index}` }));
      return { nextId: state.nextId + arrived.length + renumbered.length, visit, items: [...arrived, ...renumbered] };
    }
    if (operation === "remove" && isRecord(payload) && typeof payload.id === "string") {
      return { ...state, items: state.items.filter(item => item.id !== payload.id) };
    }
    return state;
  },
  render(state, context) {
    const items = state.items.map(item => `<li data-testid="list-item" data-entity-id="${escapeHtml(item.id)}"><span>${escapeHtml(item.label)}</span><button data-remove="${escapeHtml(item.id)}">Remove</button></li>`).join("");
    const body = `<main><h1>Dynamic list</h1>
      <form data-testid="add-form"><label>Item label <input name="label" data-testid="item-label" autocomplete="off"></label><button>Add</button></form>
      <button data-testid="reverse">Reverse list</button><ul data-testid="items">${items}</ul>
      <p data-testid="item-count" aria-live="polite">${state.items.length} items</p>
    </main>`;
    const script = `${fixtureClient(context.runToken, "dynamic-list")}
const list = document.querySelector('[data-testid="items"]');
function paint(snapshot) {
  list.replaceChildren(...snapshot.state.items.map(item => {
    const li = document.createElement('li'); li.dataset.testid = 'list-item'; li.dataset.entityId = item.id;
    const span = document.createElement('span'); span.textContent = item.label;
    const button = document.createElement('button'); button.textContent = 'Remove'; button.dataset.remove = item.id;
    li.append(span, button); return li;
  }));
  document.querySelector('[data-testid="item-count"]').textContent = snapshot.state.items.length + ' items';
}
document.querySelector('[data-testid="add-form"]').addEventListener('submit', async event => {
  event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
  paint(await mutate('add', { label: data.get('label') })); form.reset();
});
document.querySelector('[data-testid="reverse"]').addEventListener('click', async () => paint(await mutate('reverse')));
list.addEventListener('click', async event => { const id = event.target.dataset.remove; if (id) paint(await mutate('remove', { id })); });`;
    return page("Dynamic list", body, script);
  },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readLabel(value: unknown): string {
  return isRecord(value) && typeof value.label === "string" ? value.label.slice(0, 200) : "";
}
