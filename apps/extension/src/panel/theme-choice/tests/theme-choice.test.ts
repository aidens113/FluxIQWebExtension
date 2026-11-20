// The theme choice: stored under "fluxiq.ui.theme", system (the device) by default, and applied as data-theme.

import assert from "node:assert/strict";
import test from "node:test";
import { applyThemeChoice, DEFAULT_THEME_CHOICE, mountThemeChoice, normaliseThemeChoice, readThemeChoice, saveThemeChoice, THEME_CHOICE_KEY } from "../index";

type Changes = Record<string, { newValue?: unknown }>;

async function withStorage(initial: Record<string, unknown>, body: (store: Record<string, unknown>, fire: (changes: Changes) => void) => Promise<void>): Promise<void> {
  const scope = globalThis as unknown as { chrome?: unknown; document?: unknown };
  const previous = { chrome: scope.chrome, document: scope.document };
  const store = { ...initial };
  const listeners: Array<(changes: Changes, area: string) => void> = [];
  const attributes = new Map<string, string>();
  scope.document = { documentElement: { setAttribute: (name: string, value: string) => attributes.set(name, value), getAttribute: (name: string) => attributes.get(name) } };
  scope.chrome = {
    runtime: { lastError: undefined },
    storage: {
      local: {
        get: (keys: string[], done: (items: Record<string, unknown>) => void) => done(Object.fromEntries(keys.filter((key) => key in store).map((key) => [key, store[key]]))),
        set: (values: Record<string, unknown>, done?: () => void) => {
          Object.assign(store, values);
          done?.();
        }
      },
      onChanged: { addListener: (listener: (changes: Changes, area: string) => void) => listeners.push(listener) }
    }
  };
  try {
    await body(store, (changes) => listeners.forEach((listener) => listener(changes, "local")));
  } finally {
    scope.chrome = previous.chrome;
    scope.document = previous.document;
  }
}

const dataTheme = () => (document.documentElement as unknown as { getAttribute(name: string): string }).getAttribute("data-theme");

test("the key is fluxiq.ui.theme and anything but dark, light or system is system (the first-run default follows the device)", () => {
  assert.equal(THEME_CHOICE_KEY, "fluxiq.ui.theme");
  assert.equal(DEFAULT_THEME_CHOICE, "system");
  assert.equal(normaliseThemeChoice("light"), "light");
  assert.equal(normaliseThemeChoice("dark"), "dark");
  assert.equal(normaliseThemeChoice("system"), "system");
  for (const bad of [undefined, null, "", "blue", 3]) assert.equal(normaliseThemeChoice(bad), "system");
});

test("a choice is stored and read back; nothing stored is system", async () => {
  await withStorage({}, async (store) => {
    assert.equal(await readThemeChoice(), "system");
    saveThemeChoice("light");
    assert.equal(store[THEME_CHOICE_KEY], "light");
    assert.equal(await readThemeChoice(), "light");
  });
});

test("first run: nothing stored mounts as system and stays system; a stored dark is kept", async () => {
  await withStorage({}, async () => {
    mountThemeChoice();
    assert.equal(dataTheme(), "system", "the first paint follows the device");
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(dataTheme(), "system", "and so does the read when nothing was chosen");
  });
  await withStorage({ [THEME_CHOICE_KEY]: "dark" }, async () => {
    mountThemeChoice();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(dataTheme(), "dark", "a person's earlier choice of dark wins");
  });
});

test("mounting applies the default at once, then the stored choice, and follows a change live", async () => {
  await withStorage({ [THEME_CHOICE_KEY]: "light" }, async (_store, fire) => {
    mountThemeChoice();
    assert.equal(dataTheme(), "system", "the default before first paint");
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(dataTheme(), "light");
    fire({ [THEME_CHOICE_KEY]: { newValue: "dark" } });
    assert.equal(dataTheme(), "dark");
    applyThemeChoice("system");
    assert.equal(dataTheme(), "system");
  });
});
