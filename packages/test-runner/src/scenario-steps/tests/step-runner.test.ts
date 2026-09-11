import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { BrowserContext, Download, Page } from "@playwright/test";
import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { ScenarioStepRunner } from "../step-runner.js";

const origin = "http://127.0.0.1:4100";

/** A scenario tab whose locators log what Playwright would have done. */
function fakePage(url: string, log: string[]) {
  const page = new EventEmitter() as EventEmitter & Record<string, unknown>;
  let selected = 0;
  const plans = [{ value: "starter", label: "Starter" }, { value: "team", label: "Team" }];
  const locator = (name: string): unknown => ({
    click: async () => { if (name.includes("broken")) throw new Error("element not found"); log.push(`click ${name}`); },
    fill: async (value: string) => { log.push(`fill ${name} ${value}`); },
    waitFor: async (options: { state?: string }) => { log.push(`wait ${name} ${options.state}`); },
    press: async (key: string) => { log.push(`press ${name} ${key}`); if (key === "t") selected = 1; },
    setChecked: async (checked: boolean) => { log.push(`check ${name} ${checked}`); },
    setInputFiles: async (file: string) => { log.push(`upload ${name} ${path.basename(file)}`); },
    focus: async () => { log.push(`focus ${name}`); },
    evaluate: async (callback: (value: unknown) => unknown) => callback({ tagName: "SELECT", multiple: false, disabled: false, selectedIndex: selected, options: plans.map((option) => ({ ...option, disabled: false, parentElement: null })) }),
    inputValue: async () => plans[selected]!.value,
    all: async () => [locator(`${name} item`)],
    first() { return this; },
    count: async () => 1,
    textContent: async () => ` ${name} text `,
    getAttribute: async () => null,
    locator: (inner: string) => locator(`${name} > ${inner}`),
  });
  Object.assign(page, {
    url: () => url,
    isClosed: () => false,
    locator: (selector: string) => locator(selector),
    getByRole: (role: string, options: { name?: string }) => locator(`role=${role}[${options.name ?? ""}]`),
    frameLocator: (selector: string) => ({ locator: (inner: string) => locator(`${selector} >> ${inner}`) }),
    mouse: { wheel: async (x: number, y: number) => { log.push(`wheel ${x},${y}`); } },
    keyboard: { press: async (key: string) => { log.push(`keyboard ${key}`); } },
    goto: async (address: string) => { log.push(`goto ${address}`); },
    waitForLoadState: async () => undefined,
    bringToFront: async () => { log.push(`front ${url}`); },
    close: async () => { log.push(`close ${url}`); },
  });
  return page as unknown as Page & EventEmitter;
}

function harness() {
  const log: string[] = [];
  const first = fakePage(`${origin}/scenarios/basic-form/`, log);
  const pages: Page[] = [first];
  const context = new EventEmitter();
  Object.assign(context, { pages: () => pages });
  let clock = 1_000;
  return { log, first, pages, context: context as unknown as BrowserContext, now: () => (clock += 5) };
}

test("performs every operation on the active tab as trusted Playwright input and times each step", async () => {
  const uploads = await mkdtemp(path.join(os.tmpdir(), "fluxiq-steps-"));
  try {
    const { log, first, pages, context, now } = harness();
    const runner = new ScenarioStepRunner({ context, page: first, origin, isScenarioUrl: (url) => url.startsWith(`${origin}/`), uploadDirectory: uploads, now });
    const steps: ScenarioStep[] = [
      { id: "name", operation: "type", target: "testid:name", value: "Ada" },
      { id: "plan", operation: "select", target: "testid:plan", value: "team" },
      { id: "wheel", operation: "scroll", value: 400 },
      { id: "enter", operation: "press", value: "Enter" },
      { id: "enter-in-field", operation: "press", target: "role:textbox:Search", value: "Enter" },
      { id: "terms", operation: "check", target: "testid:terms", value: true },
      { id: "file", operation: "upload", target: "testid:file", value: "notes.txt" },
      { id: "frame", operation: "click", target: "frame:Checkout/testid:pay" },
      { id: "ready", operation: "waitForState", target: "testid:result" },
      { id: "mark", operation: "checkpoint" },
      { id: "go", operation: "navigate", path: "/scenarios/basic-form/" },
    ];
    for (const step of steps) assert.deepEqual(await runner.run(step), {});
    assert.deepEqual(log, [
      'fill [data-testid="name"] Ada',
      'wait [data-testid="plan"] visible', 'focus [data-testid="plan"]', 'press [data-testid="plan"] t',
      "wheel 0,400",
      "keyboard Enter",
      "press role=textbox[Search] Enter",
      'check [data-testid="terms"] true',
      'upload [data-testid="file"] notes.txt',
      'click iframe[title="Checkout"] >> [data-testid="pay"]',
      'wait [data-testid="result"] visible',
      `goto ${origin}/scenarios/basic-form/`,
    ]);
    assert.equal(await readFile(path.join(uploads, "notes.txt"), "utf8"), "FluxIQ deterministic upload\nfile: notes.txt\n");
    const timings = runner.timings();
    assert.deepEqual(timings.map((timing) => [timing.stepId, timing.operation, timing.outcome, timing.durationMs]), steps.map((step) => [step.id, step.operation, "succeeded", 5]));
    assert.equal(timings[0]!.startedAt, new Date(1_005).toISOString());
    assert.equal(pages.length, 1);
    runner.dispose();
  } finally {
    await rm(uploads, { recursive: true, force: true });
  }
});

test("switchTab, closeTab, waitForDownload, and extract act on and read the active tab", async () => {
  const { log, first, pages, context, now } = harness();
  const runner = new ScenarioStepRunner({ context, page: first, origin, isScenarioUrl: (url) => url.startsWith(`${origin}/`), uploadDirectory: os.tmpdir(), now });
  const details = fakePage(`${origin}/scenarios/multi-tab/details`, log);
  pages.push(details);
  await runner.run({ id: "to-details", operation: "switchTab", path: "/scenarios/multi-tab/details" });
  assert.equal(runner.activePage(), details);
  const { extracted } = await runner.run({ id: "read", operation: "extract", target: "testid:detail", fields: { title: "testid:title" } });
  assert.deepEqual(extracted, [{ title: '[data-testid="detail"] item > [data-testid="title"] text' }]);
  first.emit("download", { suggestedFilename: () => "report-101.csv", failure: async () => null } as unknown as Download);
  await runner.run({ id: "saved", operation: "waitForDownload", value: "report-101.csv" });
  await runner.run({ id: "back", operation: "closeTab" });
  assert.equal(runner.activePage(), first);
  assert.ok(log.includes(`close ${origin}/scenarios/multi-tab/details`));
  runner.dispose();
});

test("a failing step is timed as failed and rethrown; malformed steps are fixture errors", async () => {
  const { first, context, now } = harness();
  const runner = new ScenarioStepRunner({ context, page: first, origin, isScenarioUrl: () => true, uploadDirectory: os.tmpdir(), now });
  await assert.rejects(runner.run({ id: "gone", operation: "click", target: "testid:broken" }), /element not found/);
  assert.deepEqual(runner.timings().map((timing) => [timing.stepId, timing.outcome]), [["gone", "failed"]]);
  await assert.rejects(runner.run({ id: "no-target", operation: "click" }), (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid");
  await assert.rejects(runner.run({ id: "bad-check", operation: "check", target: "testid:terms", value: "yes" }), /boolean/);
  await assert.rejects(runner.run({ id: "no-key", operation: "press" }), /non-empty string/);
  runner.dispose();
});
