import { fixtureClient, page } from "../../../html.js";
import { fnv, RADIUS_OPTIONS, SORT_OPTIONS } from "../catalog/index.js";
import { SHELL_SCRIPT } from "../client/index.js";
import { CONTACT_INTERVAL_MS, HUMAN_CHECK_WAIT_MS } from "../limits.js";
import { CLASSIFIEDS_ROOT } from "../root.js";
import type { ClassifiedsState } from "../types.js";
import { classifiedsClasses, classifiedsIds, classifiedsStylesheet, type ClassSheet, type IdName } from "../view/index.js";

/** What every page of one session on one seed shares: its build's class names, its ids, and its timings. */
export type PageBuild = { seed: number; runToken: string; sheet: ClassSheet; ids: Record<IdName, string>; timing: PageTiming; alternateOrigin?: string };

/**
 * How long the site takes to do the things it does on its own, per seed. A
 * Flow that clicks at fixed moments meets a different page on every seed; one
 * that waits for what it needs does not.
 */
export type PageTiming = { notifyDelay: number; chatDelay: number; detailDelay: number; feedLatency: number; checkWait: number; contactInterval: number };

export function pageBuild(seed: number, runToken: string, alternateOrigin?: string): PageBuild {
  const spread = (name: string, from: number, width: number) => from + (fnv(`${seed}:${name}`) % width);
  return {
    seed,
    runToken,
    sheet: classifiedsClasses(seed),
    ids: classifiedsIds(seed),
    timing: {
      notifyDelay: spread("notify", 1_600, 1_400),
      chatDelay: spread("chat", 900, 700),
      detailDelay: spread("detail", 500, 500),
      feedLatency: spread("latency", 250, 250),
      checkWait: HUMAN_CHECK_WAIT_MS,
      contactInterval: CONTACT_INTERVAL_MS,
    },
    ...(alternateOrigin === undefined ? {} : { alternateOrigin }),
  };
}

/**
 * A whole document: the markup, the build's stylesheet, and the scripts, with
 * everything a script needs handed over as `cfg`. The shell's script always
 * runs first; `scripts` follow it in order.
 */
export function classifiedsDocument(build: PageBuild, state: ClassifiedsState, title: string, body: string, scripts: readonly string[], extra: Record<string, unknown> = {}): string {
  const shadowRole = (name: string) => `x${fnv(`${build.seed}:shadow:${name}`).toString(36)}`;
  const config = {
    k: build.sheet.keys,
    n: build.sheet.names,
    root: CLASSIFIEDS_ROOT,
    ids: build.ids,
    shadow: { chip: shadowRole("chip"), pop: shadowRole("pop"), row: shadowRole("row"), btn: shadowRole("btn"), primary: shadowRole("primary") },
    radii: RADIUS_OPTIONS,
    sorts: SORT_OPTIONS,
    session: { consent: state.consent, notificationPrompt: state.notificationPrompt, locationCheck: state.locationCheck, chat: state.chat, mode: state.mode, refusedContacts: state.refusedContacts },
    timing: build.timing,
    ...extra,
  };
  const script = [fixtureClient(build.runToken, "local-classifieds"), `const cfg = ${JSON.stringify(config).replaceAll("<", "\\u003c")};`, SHELL_SCRIPT, ...scripts].join("\n");
  return page(title, `${body}<style>${classifiedsStylesheet(build.sheet.keys)}</style>`, script);
}
