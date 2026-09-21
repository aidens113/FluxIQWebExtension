// The page's half of carrying a paginated `web.dom.extract_list` read across
// documents (`shared/extraction-continuation.ts` says why and how): the list
// read granted to the verbs when the worker asked for a continuation, which
// goes on from the worker's checkpoint and sends its own before each control it
// follows.
//
// A checkpoint the worker does not take -- a sender with no worker behind it,
// such as the content harness or the test runner's broadcast -- is not a
// failure of the read. The read goes on exactly as it would have without one;
// what is lost is only the ability to continue in a document the next control
// loads, which is what every read had before this existed.

import { EXTRACTION_CHECKPOINT_MESSAGE, readExtractionCheckpoint, type ExtractionCheckpoint, type ExtractionCheckpointMessage, type ExtractionContinuation } from "../../shared/extraction-continuation";
import { extractList, type ListExtractionOptions, type ListExtractionOutcome } from "../extraction";
import type { WebAutomationExtractListRequest } from "../types";

/** The list read the verbs are granted: the plain one, or one that continues a read and checkpoints its own. */
export type ListRead = (request: WebAutomationExtractListRequest, options?: ListExtractionOptions) => Promise<ListExtractionOutcome>;

/**
 * The list read for a command that carried `continuation`, or the plain one
 * when it carried none. A continuation whose resume is not a checkpoint is
 * refused rather than read from the start, because starting over would read
 * pages the read already took as though they were new.
 */
export function listReadFor(continuation: unknown): ListRead {
  if (continuation === undefined) return extractList;
  const { token, resume } = (typeof continuation === "object" && continuation !== null ? continuation : {}) as Partial<ExtractionContinuation>;
  const checkpoint = resume === undefined ? undefined : readExtractionCheckpoint(resume);
  if (typeof token !== "string" || token === "" || (resume !== undefined && checkpoint === undefined)) {
    return () => Promise.reject(new Error("The extraction continuation the worker sent is not one this page can go on from."));
  }
  return (request, options = {}) => extractList(request, { ...options, resume: checkpoint, checkpoint: (progress) => sendCheckpoint(token, progress) });
}

/** Hands the read so far to the worker and waits until it has it, or has said it will not take it. */
async function sendCheckpoint(token: string, checkpoint: ExtractionCheckpoint): Promise<void> {
  const message: ExtractionCheckpointMessage = { type: EXTRACTION_CHECKPOINT_MESSAGE, token, checkpoint };
  try {
    await chrome.runtime.sendMessage(message);
  } catch (error) {
    // No receiver: the read goes on without a continuation (see the header).
    if (!isNoReceiver(error)) throw error;
  }
}

function isNoReceiver(error: unknown): boolean {
  return error instanceof Error && /Receiving end does not exist|Could not establish connection/iu.test(error.message);
}
