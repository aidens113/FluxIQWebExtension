/**
 * Which of Core's threads the chat shows: the project's most recent one, or
 * the thread about one automation (a Flow), opened from the automations tab.
 */
export type ChatTarget = { kind: "latest" } | { kind: "automation"; flowId: string; name: string };
