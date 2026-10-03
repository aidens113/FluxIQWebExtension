// Which tab the activity overlay is drawn in: the page FluxIQ is automating,
// never an extension page and never FluxIQ's own web panel.
//
// In order, the first candidate that is an ordinary web page not on one of
// FluxIQ's origins:
//
// 1. the tab the last runtime command ran in -- the one the automation
//    actually drives. It is remembered after the runtime status moves on, so
//    a snapshot or a model call between two actions does not lose it;
// 2. the tab the extension holds as active;
// 3. the tab active in each window, the focused window's first.
//
// The t185 relay used only (2), with no check of its own, so it depended on
// the extension's idea of the active tab being the automated page. A browser
// with an extension page, FluxIQ's web panel and the scenario page open at
// once -- the Lab's, and often a person's -- makes that a matter of which was
// activated last. Asking for the driven page first, and refusing FluxIQ's own
// pages outright, removes the dependence. (It was not why the overlay went
// unseen in the Lab: the t191 probe found the t185 relay reaching the right
// tab, and the overlay drawn under the side panel. See `status-pill.ts`.)

/** A tab as the browser lists it. */
export type OverlayTabCandidate = { readonly id?: number | undefined; readonly url?: string | undefined };

export type OverlayTargetDeps = {
  /** The tab the last runtime command ran in, when the runtime status names one. */
  readonly drivenTabId: () => number | undefined;
  /** The tab the extension holds as active. */
  readonly activeTabId: () => number | undefined;
  /** The tab active in each window, the focused window's first. */
  readonly activeTabs: () => Promise<readonly OverlayTabCandidate[]>;
  /** The tab's URL. Rejects when the tab is gone. */
  readonly tabUrl: (tabId: number) => Promise<string | undefined>;
  /** FluxIQ's own origins -- its web panel and API, its gateway -- as URLs. */
  readonly ownOrigins: () => readonly string[];
};

const DRAWABLE_PROTOCOLS: ReadonlySet<string> = new Set(["http:", "https:", "file:"]);

export class OverlayTarget {
  private driven: number | undefined;

  constructor(private readonly deps: OverlayTargetDeps) {}

  /** The tab to draw in now, or undefined when no open tab is one the overlay may draw on. */
  async resolve(): Promise<number | undefined> {
    const driven = this.deps.drivenTabId();
    if (driven !== undefined) this.driven = driven;
    const own = ownOriginSet(this.deps.ownOrigins());
    const tried = new Set<number>();
    for (const tabId of [this.driven, this.deps.activeTabId()]) {
      if (tabId === undefined || tried.has(tabId)) continue;
      tried.add(tabId);
      if (await this.drawable(tabId, own)) return tabId;
    }
    for (const tab of await this.deps.activeTabs()) {
      if (tab.id === undefined || tried.has(tab.id)) continue;
      tried.add(tab.id);
      if (isDrawable(tab.url, own)) return tab.id;
    }
    return undefined;
  }

  /**
   * Every tab to draw in now: the one `resolve` names, then the focused
   * window's front tab when it is another drawable page. The automation can
   * drive one tab while the person looks at another -- a Flow's test replaying
   * in the scenario tab while a result it opened in a new tab is in front
   * (screenshot 00013 of the run-murwd8le-79e735a8 UI review) -- and the
   * status belongs on the page the person is looking at, as well as on the
   * page being worked.
   */
  async resolveAll(): Promise<number[]> {
    const primary = await this.resolve();
    const targets = primary === undefined ? [] : [primary];
    const front = (await this.deps.activeTabs())[0];
    if (front?.id !== undefined && front.id !== primary && isDrawable(front.url, ownOriginSet(this.deps.ownOrigins()))) targets.push(front.id);
    return targets;
  }

  private async drawable(tabId: number, own: ReadonlySet<string>): Promise<boolean> {
    try {
      return isDrawable(await this.deps.tabUrl(tabId), own);
    } catch (error) {
      // A tab whose address cannot be read -- it closed -- is no place to
      // draw. A remembered tab that is gone is forgotten.
      if (tabId === this.driven) this.driven = undefined;
      if (error instanceof Error) return false;
      throw error;
    }
  }
}

function isDrawable(url: string | undefined, own: ReadonlySet<string>): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
  if (!DRAWABLE_PROTOCOLS.has(parsed.protocol)) return false;
  return !own.has(parsed.origin);
}

/** Origins of FluxIQ's URLs; a gateway's `ws:`/`wss:` address names the same host as `http:`/`https:`. */
function ownOriginSet(urls: readonly string[]): ReadonlySet<string> {
  const origins = new Set<string>();
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "ws:") parsed.protocol = "http:";
      if (parsed.protocol === "wss:") parsed.protocol = "https:";
      origins.add(parsed.origin);
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      // An unset or malformed setting names no origin to keep the overlay off.
    }
  }
  return origins;
}
