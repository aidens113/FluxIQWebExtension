/** One node of the charted Flow, with what the run recorded going through it. */
export type ChartNode = {
  step: number;
  /** act, read, navigate, type, select, ... in plain words. */
  kind: string;
  /** The control or list in words, never a selector. */
  target?: string;
  /** The value typed or chosen. */
  typed?: string;
  /** What the run recorded going through the node (the address, the rows read), already shortened. */
  example: string[];
  /** The act of the instruction this node does, in Core's ids. */
  act?: string;
  /** The node reads the result. */
  result: boolean;
};

/** A bracket round the nodes from `from` to `to` (step numbers), saying what they repeat over. */
export type ChartLoop = { from: number; to: number; label: string };

/** A side arrow between two steps, labelled with its condition. */
export type ChartBranch = { from: number; to: number; label: string };

/** A value the run typed or chose, named by the control it went into. */
export type ChartParameter = { name: string; value: string };

/** What the attempt returned, and where it comes from: the answer the chat showed, or the completion the model offered that the check did not accept (with the check's outcome in plain words). */
export type ChartOutput =
  | { kind: "rows"; source: "shown to the person" | "offered, not accepted"; headline: string; columns: string[]; rows: string[][]; total: number; check: string[] }
  | { kind: "text"; source: "shown to the person"; text: string }
  | { kind: "none"; why: string };

/** Where to read a run's chart from. `evidenceDirectory` holds this attempt's answer (default the run folder); `saved` says the attempt saved a Flow (default: its `attempt.json` says so). */
export type ChartRead = { runDirectory: string; evidenceDirectory?: string; attempt?: number; saved?: boolean };

/** Everything the picture draws, read from the run's own files. */
export type ChartFlow = {
  /** Whether the nodes are a saved Flow or the draft as it stood. */
  source: "saved Flow" | "draft";
  /** Which attempt of a series this is; absent for the run as a whole. */
  attempt?: number;
  instruction: string | null;
  parameters: ChartParameter[];
  nodes: ChartNode[];
  loops: ChartLoop[];
  branches: ChartBranch[];
  /** Steps tried that are not in the Flow (looks, failed tries, dropped repeats). */
  otherSteps: number;
  output: ChartOutput;
};
