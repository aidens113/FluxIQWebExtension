import type { BrowserContext, Page } from "@playwright/test";

/**
 * Runs one recording-script step against a page, giving the site its budget
 * in the page's own time rather than in wall-clock time.
 *
 * A step's `timeoutMs` is the scenario's statement about the site: the offer
 * opens within eight seconds, the next batch within ten. When the machine is
 * saturated -- a full sweep runs every package's browser tests at once, and
 * the CPU sits at 100% with the page file paging -- a page's renderer can go
 * ten seconds without running: its own timers fire late, the input a click
 * sends waits unacknowledged ("performing click action"), and a wall-clock
 * timeout charges all of that to the site. The step then fails although the
 * site did nothing wrong, which is not what the step measures.
 *
 * So each page carries a heartbeat: a 100 ms interval timer that adds up how
 * late it fires. Time it was late is time the page's main thread was not
 * running. This process keeps the same account of itself, since the lab's
 * server and the Playwright driver run in it. The step's deadline is its
 * budget plus whichever of the two lost more time while the step ran, so a
 * starved page gets its budget back and a page that ran and still never
 * reached the state fails as fast as before. `act` is started with no timeout
 * of its own and is abandoned (its rejection swallowed) when the deadline
 * passes; the context closing later ends it.
 *
 * Credit is capped: past a minute of lost time the run is no longer measuring
 * the site, and a page whose timers are throttled rather than starved must not
 * wait for ever.
 */
export async function withinPageTime<T>(page: Page, budgetMs: number, what: string, act: () => Promise<T>, diagnose?: () => Promise<string>): Promise<T> {
  watchProcess();
  const reader = await heartbeatOf(page);
  // The clock starts once the page has answered: a page frozen before the step began owes the step nothing.
  const startPage = await reader.read(page);
  const start = performance.now();
  const startProcess = processStalledMs;
  const outcome = act().then((value) => ({ value }));
  outcome.catch(() => undefined);
  let credit = 0;
  for (;;) {
    const remaining = start + budgetMs + credit - performance.now();
    if (remaining > 0) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const lapse = new Promise<undefined>((resolve) => {
        timer = setTimeout(() => resolve(undefined), remaining);
      });
      const settled = await Promise.race([outcome, lapse]).finally(() => clearTimeout(timer));
      if (settled) return settled.value;
      continue;
    }
    const pageLost = (await reader.read(page)) - startPage;
    const processLost = processStalledMs - startProcess;
    const next = Math.min(MAX_CREDIT_MS, Math.max(pageLost, processLost));
    if (next > credit) {
      credit = next;
      continue;
    }
    const detail = diagnose ? ` ${await diagnose().catch((error: unknown) => String(error))}` : "";
    throw new Error(`${what}: not done within ${budgetMs} ms of the page's own time (${Math.round(credit)} ms more allowed for time the page or this process was starved).${detail}`);
  }
}

const TICK_MS = 100;
/** Lateness under this is ordinary timer jitter, not starvation. */
const LATE_MS = 50;
const MAX_CREDIT_MS = 60_000;
const HEARTBEAT_OPTIONS = { name: "__scenarioLabHeartbeat", tick: TICK_MS, late: LATE_MS };

let processStalledMs = 0;
let processWatch: ReturnType<typeof setInterval> | undefined;

function watchProcess(): void {
  if (processWatch) return;
  let last = performance.now();
  processWatch = setInterval(() => {
    const now = performance.now();
    const late = now - last - TICK_MS;
    if (late > LATE_MS) processStalledMs += late;
    last = now;
  }, TICK_MS);
  processWatch.unref();
}

/** The page's heartbeat, as an init script so every document the page loads carries one; it is invisible to the site's own enumeration. */
function heartbeat({ name, tick, late }: { name: string; tick: number; late: number }): void {
  const scope = globalThis as unknown as Record<string, unknown>;
  if (scope[name]) return;
  const account = { stalledMs: 0, lastTick: performance.now() };
  Object.defineProperty(scope, name, { value: account, enumerable: false });
  setInterval(() => {
    const now = performance.now();
    const lateBy = now - account.lastTick - tick;
    if (lateBy > late) account.stalledMs += lateBy;
    account.lastTick = now;
  }, tick);
}

/**
 * The page's lost time so far, the tick that is overdue right now included:
 * a read that reaches the page just after a freeze can run before the late
 * tick does, and would otherwise see none of it. The total only grows, since
 * the late tick adds at least what was overdue when it was read.
 */
function lostSoFar({ name, tick, late }: { name: string; tick: number; late: number }): [number, number] {
  const account = (globalThis as unknown as Record<string, { stalledMs: number; lastTick: number } | undefined>)[name];
  if (!account) return [performance.timeOrigin, 0];
  const overdue = performance.now() - account.lastTick - tick;
  return [performance.timeOrigin, account.stalledMs + (overdue > late ? overdue : 0)];
}

/** A page's running total of lost time, carried across its navigations: each new document starts its own count from zero. */
class PageHeartbeat {
  private origin: number | undefined;
  private seen = 0;
  private total = 0;

  async read(page: Page): Promise<number> {
    try {
      const [origin, stalled] = await page.evaluate(lostSoFar, HEARTBEAT_OPTIONS);
      if (origin !== this.origin) {
        this.origin = origin;
        this.seen = 0;
      }
      this.total += Math.max(0, stalled - this.seen);
      this.seen = stalled;
    } catch {
      // Mid-navigation or closed: nothing new to count, and the step itself reports a closed page.
    }
    return this.total;
  }
}

const armed = new WeakSet<BrowserContext>();
const heartbeats = new WeakMap<Page, PageHeartbeat>();

async function heartbeatOf(page: Page): Promise<PageHeartbeat> {
  const context = page.context();
  if (!armed.has(context)) {
    armed.add(context);
    await context.addInitScript(heartbeat, HEARTBEAT_OPTIONS);
  }
  let reader = heartbeats.get(page);
  if (!reader) {
    reader = new PageHeartbeat();
    heartbeats.set(page, reader);
    // The document already open predates the init script.
    await page.evaluate(heartbeat, HEARTBEAT_OPTIONS).catch(() => undefined);
  }
  return reader;
}
