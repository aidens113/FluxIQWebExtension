import type { ChatDownload, ChatResult, ChatResultsPort } from "@fluxiq/ui-components";
import { AUTOMATION_PANEL_MESSAGES } from "../../../../../shared/protocol";
import type { PanelStore } from "../../../../state";
import { readRunReplies } from "../../../../automations";
import { refusalOf } from "../../reply";
import type { RuntimeListen } from "../activity";
import { conversationOfPush } from "./conversation-of-push";
import { createThreadOutcomes } from "./create-thread-outcomes";
import { finishedRunOf } from "./finished-run-of";
import { outcomeOfRun } from "./outcome-of-run";
import { readExport } from "./read-export";

const NOT_FOUND = "I do not have that result in this session.";

/**
 * The chat's answer turn, from the runs this panel session saw finish. Until Core
 * writes attempt records, each run the activity feed reports done becomes an outcome
 * of its first dataset's real rows, read through `runDetail` and `exportDataset`.
 * The records carry no real spend, so the port says `reportsSpend: false`. Nothing
 * here throws: a failed read is a failed result.
 */
export function resultsPort(request: PanelStore["request"], listen: RuntimeListen, download: ChatDownload, now: () => number = Date.now): ChatResultsPort {
  const held = createThreadOutcomes();
  const reading = new Set<Promise<void>>();

  const read = (run: NonNullable<ReturnType<typeof finishedRunOf>>): void => {
    const job: Promise<void> = (async () => {
      try {
        const outcome = await outcomeOfRun(request, run, now);
        if (outcome.ok && outcome.value !== undefined) {
          held.add({ run, outcome: outcome.value });
        }
      } catch {
        /* best-effort: a run that cannot be read has no answer turn, and the chat tells it as it always has */
      }
    })().finally(() => reading.delete(job));
    reading.add(job);
  };
  listen((message) => {
    const spoke = conversationOfPush(message);
    if (spoke !== undefined) {
      held.noteConversation(spoke.projectId, spoke.conversationId);
    }
    const finished = finishedRunOf(message);
    if (finished !== undefined) {
      read(finished);
    }
  });
  const settled = async (): Promise<void> => {
    await Promise.all([...reading]);
  };

  return {
    reportsSpend: false,
    readThread: async ({ projectId, conversationId }) => {
      await settled();
      return { ok: true, value: { outcomes: held.inThread(projectId, conversationId) } };
    },
    readAttempt: async ({ projectId, attemptId }) => {
      await settled();
      const outcome = held.byAttempt(projectId, attemptId);
      return outcome === undefined ? { ok: false, sentence: NOT_FOUND } : { ok: true, value: outcome };
    },
    exportRows: async ({ runId, datasetId, format }) => {
      const exported = await readExport(request, { runId, datasetId, format });
      if (!exported.ok) {
        return exported;
      }
      if (exported.value.tooLarge) {
        return { ok: false, sentence: "That file is too large to save here. Export it in FluxIQ." };
      }
      try {
        download(exported.value.fileName, exported.value.contentType, exported.value.body);
      } catch {
        return { ok: false, sentence: "I couldn't save the file here. Try again, or export it in FluxIQ." };
      }
      return { ok: true, value: { fileName: exported.value.fileName } };
    },
    runAgain: async ({ projectId, taskId }): Promise<ChatResult<{ attemptId: string }>> => {
      await settled();
      const flowId = held.byTask(projectId, taskId)?.attempt.flowId;
      if (flowId === undefined) {
        return { ok: false, sentence: "I can't run this one again from here.", unsupported: true };
      }
      const reply = await request({ type: AUTOMATION_PANEL_MESSAGES.runAutomation, flowId });
      const refused = refusalOf(reply);
      if (refused !== undefined) {
        return refused;
      }
      const started = readRunReplies.run(reply.ok ? reply.value : undefined);
      return started === undefined
        ? { ok: false, sentence: "FluxIQ's answer to starting the run could not be read." }
        : { ok: true, value: { attemptId: `attempt-${started.run.runId}` } };
    }
  };
}
