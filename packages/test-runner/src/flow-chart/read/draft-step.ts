/** One entry of Core's `core.flow_draft` evidence, as the step files hold it (only what the chart reads). */
export type DraftStep = {
  step: number;
  actionId: string;
  input?: { parameters?: Record<string, unknown> };
  does?: { target?: string; text?: string };
  bindable?: string[];
  inResult?: boolean;
  act?: string;
  runs?: string;
  callId?: string;
};
