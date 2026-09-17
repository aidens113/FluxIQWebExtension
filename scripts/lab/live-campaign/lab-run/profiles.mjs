/** The LLM profile each kind of task runs under unless `--llm-profile` names one for every task. */
export const DEFAULT_PROFILES = Object.freeze({ create: "lab-create-flow", repair: "lab-adapt-repair" });
