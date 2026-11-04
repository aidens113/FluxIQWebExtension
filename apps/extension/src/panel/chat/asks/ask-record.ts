// The parts of Core's question that the extension words, read by shape. The
// record is Core's (`AutomationStudioConversationAsk`), relayed as Core sent it;
// a field missing or of another shape reads as absent, and a record with no id
// or kind is not a question this panel can word (the chat then draws its own).

/** Core's question, as far as the extension reads it. */
export type AskRecord = {
  readonly askId: string;
  readonly kind: string;
  /** The classes an answer would commit: what a permission ask lacks, what any other ask says it does. */
  readonly commits: readonly string[];
  readonly options: readonly { id: string; label: string; description?: string }[];
  /** What the question is about, as Core named it. */
  readonly control: { readonly name: string | null; readonly kind: string | null };
  /** What FluxIQ would do to it, in the domain's verb ("press"), when Core said. */
  readonly verb: string | null;
};

/** `value` as a question, or null when it is not one. */
export function askRecordOf(value: unknown): AskRecord | null {
  const record = asRecord(value);
  if (record === undefined) return null;
  const askId = text(record.askId);
  const kind = text(record.kind);
  if (askId === null || kind === null) return null;
  const missing = textList(record.missing);
  const consequences = textList(record.consequences);
  const control = asRecord(record.control);
  return {
    askId,
    kind,
    commits: kind === "permission" && missing.length > 0 ? missing : consequences,
    options: optionsOf(record.options),
    control: { name: text(control?.name), kind: text(control?.kind) },
    verb: text(asRecord(asRecord(record.permissionRequest)?.action)?.verb)
  };
}

function optionsOf(value: unknown): AskRecord["options"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const option = asRecord(entry);
    const id = text(option?.id);
    const label = text(option?.label);
    if (id === null || label === null) return [];
    const description = text(option?.description);
    return [{ id, label, ...(description === null ? {} : { description }) }];
  });
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
