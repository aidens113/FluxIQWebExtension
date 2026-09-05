import { escapeHtml, fixtureClient, page } from "../../html.js";
import { createScenarioManifest, defineScenario } from "../../types.js";

export type DynamicListItem = { id: string; label: string };
export type DynamicListState = { nextId: number; items: DynamicListItem[] };

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
  }),
  createState(seed) {
    const firstId = (Math.abs(seed) % 9000) + 1000;
    return {
      nextId: firstId + 3,
      items: [0, 1, 2].map(index => ({ id: `item-${firstId + index}`, label: `Seed ${seed} item ${index + 1}` })),
    };
  },
  mutate(state, operation, payload) {
    if (operation === "add") {
      const label = readLabel(payload) || `Item ${state.nextId}`;
      return { nextId: state.nextId + 1, items: [...state.items, { id: `item-${state.nextId}`, label }] };
    }
    if (operation === "reverse") return { ...state, items: [...state.items].reverse() };
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
