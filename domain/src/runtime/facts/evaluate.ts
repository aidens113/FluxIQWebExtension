// The batched, zero-wait, three-valued fact check (plan B1, Core C9): the
// `fact-evaluation` the host runtime offers beside `expectation-evaluation`.
//
// One batch is one gateway command. Every condition is turned into a literal
// claim first (`./query.ts`); the claims that can be asked go to the page
// together as one `web.page.facts` command with no wait in it, and the page
// answers each in the same order. The extension asks each frame a batch names
// once, so even a batch about several frames is one round trip from here.
//
// The differences from the expectation evaluator are the point of it:
//
//  - **No wait.** `web.dom.assert` polls until its claim holds or its window
//    runs out, which is right for "the page should get there" and wrong for
//    "which handler applies now". A fact is read once, as the page stands.
//  - **Three values.** An expectation's verdict is a boolean and a count, so a
//    timed-out check reads as false. Here `false` is only ever a positive
//    observation in a fully read document; a command that failed, timed out or
//    was never answered, a page that answered with something unreadable, a
//    frame that did not answer, a document still loading or another document
//    than the one Core last saw -- each is `unknown`, with its reason.
//  - **It never throws.** A broken batch answers every condition `unknown`
//    (`capture_failed`), because Core will gate on these answers and an
//    exception there would end a run over a question nobody could answer.
//
// What reaches Core is screened a second time: every string an answer quotes
// passes the packet's secret screen (`screenedWebLlmText`), and an address is
// published only as the packet would publish it (`screenedEvidenceUrl`). The
// page already left out every sensitive control; this is the fence behind it.

import type { JsonObject } from "fluxiq/core";
import {
  WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE,
  webAutomationFactCheckResultValue,
  type WebAutomationFactAnswer,
  type WebAutomationFactCheckRequest,
  type WebAutomationFactEvidence,
  type WebAutomationFactQuery,
  type WebAutomationFactUnknownReason
} from "../../actions/fact-check";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import type { WebAutomationExpectationDispatch } from "../expectation";
import { screenedEvidenceUrl, screenedWebLlmText } from "../llm-evidence";
import type { WebAutomationFactEvaluationContext, WebAutomationFactEvaluator, WebAutomationFactResult } from "./condition";
import { webAutomationFactQuery } from "./query";

/** How the evaluator reaches the paired browser; the host runtime's gateway, with its finite command bound. */
export type WebAutomationFactDispatch = (
  request: Parameters<WebAutomationExpectationDispatch>[0] & { timeoutMs?: number }
) => ReturnType<WebAutomationExpectationDispatch>;

/** Names this evaluator in the command's metadata, so a page-side trace says who asked. */
const FACT_SOURCE = "web-automation-fact-evaluation";

/**
 * The bound on the one command. The page answers synchronously, so this is
 * only how long a silent browser may hold a gate before every condition reads
 * `unknown`.
 */
const FACT_COMMAND_TIMEOUT_MS = 5_000;

export function createWebAutomationFactEvaluator(dispatch: WebAutomationFactDispatch, now: () => number = Date.now): WebAutomationFactEvaluator {
  return async (conditions, context = {}) => {
    try {
      return await evaluateBatch(dispatch, conditions, context, now);
    } catch {
      // The evaluator itself broke: nothing was judged, and saying `false`
      // would invent an observation. Each condition is unknown, and says why.
      return conditions.map(() => unknown("capture_failed", now()));
    }
  };
}

async function evaluateBatch(
  dispatch: WebAutomationFactDispatch,
  conditions: readonly unknown[],
  context: WebAutomationFactEvaluationContext,
  now: () => number
): Promise<WebAutomationFactResult[]> {
  const readings = conditions.map((condition) => webAutomationFactQuery(condition, context));
  const asked: { index: number; query: WebAutomationFactQuery }[] = [];
  readings.forEach((reading, index) => {
    if ("query" in reading) asked.push({ index, query: reading.query });
  });
  // Every slot starts unknown; an asked claim's slot is overwritten only by an
  // answer the page actually gave. A cancelled run asks nothing.
  const results: WebAutomationFactResult[] = readings.map((reading) => ("unknown" in reading ? unknown(reading.unknown, now()) : unknown("capture_failed", now())));
  if (asked.length === 0 || context.signal?.aborted) return results;

  const answers = await askPage(dispatch, asked.map((entry) => entry.query), context, now);
  if (answers === UNANSWERED) return results;
  asked.forEach((entry, position) => {
    results[entry.index] = published(answers[position] ?? unknown("capture_failed", now()), entry.query, answers.url);
  });
  return results;
}

type PageAnswers = WebAutomationFactAnswer[] & { url?: string | undefined };

/** The command produced no answers: it threw, did not succeed, or answered with something that is not one. */
const UNANSWERED = "unanswered";

/** The page's answers in query order, or `UNANSWERED`. */
async function askPage(
  dispatch: WebAutomationFactDispatch,
  queries: WebAutomationFactQuery[],
  context: WebAutomationFactEvaluationContext,
  now: () => number
): Promise<PageAnswers | typeof UNANSWERED> {
  const request: WebAutomationFactCheckRequest = {
    queries,
    ...(context.documentTimeOrigin === undefined ? {} : { documentTimeOrigin: context.documentTimeOrigin })
  };
  let result: Awaited<ReturnType<WebAutomationFactDispatch>>;
  try {
    result = await dispatch({
      outputId: WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE,
      payload: request as unknown as JsonObject,
      timeoutMs: FACT_COMMAND_TIMEOUT_MS,
      metadata: {
        source: FACT_SOURCE,
        domainId: WEB_AUTOMATION_DOMAIN_ID,
        ...(context.nodeId === undefined ? {} : { nodeId: context.nodeId }),
        ...(context.attemptId === undefined ? {} : { attemptId: context.attemptId })
      }
    });
  } catch {
    // The gateway threw before any answer: the page was not read.
    return UNANSWERED;
  }
  // Only a command that succeeded carries answers. `failed`, `timed_out`,
  // `cancelled`, `unknown` or no status at all says nothing about the page.
  if (!result.ok || result.status !== "succeeded") return UNANSWERED;
  const page = webAutomationFactCheckResultValue(isRecord(result.payload) ? result.payload.result : undefined, now());
  if (!page || page.answers.length !== queries.length) return UNANSWERED;
  const answers: PageAnswers = page.answers;
  if (page.document?.url !== undefined) answers.url = page.document.url;
  return answers;
}

/** An answer as Core may see it: every quoted string screened, and a URL claim's address as the packet would publish it. */
function published(answer: WebAutomationFactAnswer, query: WebAutomationFactQuery, url: string | undefined): WebAutomationFactResult {
  const evidence = screenedEvidence(answer.evidence, query, url);
  return { result: answer.result, ...(evidence ? { evidence } : {}), capturedAt: answer.capturedAt };
}

function screenedEvidence(evidence: WebAutomationFactEvidence | undefined, query: WebAutomationFactQuery, url: string | undefined): WebAutomationFactEvidence | undefined {
  const screened: WebAutomationFactEvidence = { ...(evidence ?? {}) };
  if (screened.excerpt !== undefined) screened.excerpt = screenedWebLlmText(screened.excerpt);
  if (screened.element) {
    const element = { ...screened.element };
    for (const key of ["accessibleName", "name", "id", "testId", "selector"] as const) {
      const text = element[key];
      if (text !== undefined) element[key] = screenedWebLlmText(text);
    }
    screened.element = element;
  }
  if (query.kind === "url") {
    const address = url === undefined ? undefined : screenedEvidenceUrl(url);
    if (address === undefined) delete screened.excerpt;
    else screened.excerpt = address;
  }
  return Object.keys(screened).length ? screened : undefined;
}

function unknown(reason: WebAutomationFactUnknownReason, capturedAt: number): WebAutomationFactResult {
  return { result: "unknown", evidence: { reason }, capturedAt };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
