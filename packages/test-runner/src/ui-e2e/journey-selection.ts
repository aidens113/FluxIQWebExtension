// Which journeys a `pnpm ui:e2e` run selects, from its command-line arguments.
//
// The provider-free lane is the default. A provider-lane journey is selected
// only when the provider lane is named explicitly (`--lane provider` or
// `--lane all`), or when it is named by `--journey`; in the second case it is
// selected and reported `not_run` rather than silently dropped, so asking for a
// journey that did not run never passes. A journey's prerequisites are selected
// with it: the restart journey reuses the Flows the extraction and failure
// journeys saved in the same run.
import { RunnerFailure } from "../failure.js";

export type UiE2eLaneSelection = "provider-free" | "provider" | "all";
export type UiE2eJourneyLane = "provider-free" | "provider";

export const UI_E2E_JOURNEY_IDS = ["F1", "F2", "F3", "F4", "P1", "P2", "P3", "P4", "P5", "P6"] as const;
export type UiE2eJourneyId = typeof UI_E2E_JOURNEY_IDS[number];

export type UiE2eJourneyDefinition = Readonly<{
  id: UiE2eJourneyId;
  /** A closed name for the journey, never a page value. */
  name: string;
  lane: UiE2eJourneyLane;
  /** Journeys whose saved Flows this one needs from the same run. */
  requires: readonly UiE2eJourneyId[];
}>;

/** The Week 2 suite's journeys, in the order a run executes them. */
export const UI_E2E_JOURNEYS: readonly UiE2eJourneyDefinition[] = Object.freeze([
  { id: "F1", name: "record_generate_run", lane: "provider-free", requires: [] },
  { id: "F2", name: "extraction", lane: "provider-free", requires: [] },
  { id: "F3", name: "failure_presentation", lane: "provider-free", requires: [] },
  { id: "F4", name: "restart_reuse", lane: "provider-free", requires: ["F2", "F3"] },
  { id: "P1", name: "instruction_creation", lane: "provider", requires: [] },
  { id: "P2", name: "repair_review_apply", lane: "provider", requires: [] },
  { id: "P3", name: "revert_history", lane: "provider", requires: [] },
  { id: "P4", name: "restart_reuse_repaired", lane: "provider", requires: [] },
  { id: "P5", name: "permission_grant_refuse", lane: "provider", requires: [] },
  { id: "P6", name: "improve_existing_flow", lane: "provider", requires: [] },
] as const satisfies readonly UiE2eJourneyDefinition[]);

export type UiE2eArguments = Readonly<{
  lane: UiE2eLaneSelection;
  /** True when `--lane` was given; the provider lane never runs by default. */
  laneExplicit: boolean;
  /** The journeys named by `--journey`, or empty for every journey in the lane. */
  journeys: readonly UiE2eJourneyId[];
}>;

const LANES: readonly UiE2eLaneSelection[] = ["provider-free", "provider", "all"];

function usage(reasonCode: string, message: string): RunnerFailure {
  return new RunnerFailure("fixture.invalid", message, { details: { reasonCode } });
}

function journeyId(value: string | undefined): UiE2eJourneyId {
  const id = value?.trim().toUpperCase();
  if (!id || !(UI_E2E_JOURNEY_IDS as readonly string[]).includes(id)) throw usage("ui_e2e.usage.journey_unknown", `--journey takes one of ${UI_E2E_JOURNEY_IDS.join(", ")}`);
  return id as UiE2eJourneyId;
}

/**
 * Parses `--lane provider-free|provider|all` and `--journey <id>...` (repeated,
 * or several ids after one flag, or comma-separated). Anything else is refused
 * with a closed `ui_e2e.usage.*` code.
 */
export function parseUiE2eArguments(argv: readonly string[]): UiE2eArguments {
  let lane: UiE2eLaneSelection = "provider-free";
  let laneExplicit = false;
  const journeys: UiE2eJourneyId[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]!;
    const [flag, inline] = argument.startsWith("--") && argument.includes("=") ? [argument.slice(0, argument.indexOf("=")), argument.slice(argument.indexOf("=") + 1)] : [argument, undefined];
    if (flag === "--lane") {
      if (laneExplicit) throw usage("ui_e2e.usage.lane_repeated", "--lane may be given once");
      const value = inline ?? argv[++index];
      if (!value || !(LANES as readonly string[]).includes(value)) throw usage("ui_e2e.usage.lane_unknown", `--lane takes one of ${LANES.join(", ")}`);
      lane = value as UiE2eLaneSelection;
      laneExplicit = true;
    } else if (flag === "--journey") {
      const values: string[] = inline !== undefined ? [inline] : [];
      while (inline === undefined && index + 1 < argv.length && !argv[index + 1]!.startsWith("--")) values.push(argv[++index]!);
      if (values.length === 0) throw usage("ui_e2e.usage.journey_missing", "--journey needs at least one journey id");
      for (const value of values.flatMap(item => item.split(","))) {
        const id = journeyId(value);
        if (!journeys.includes(id)) journeys.push(id);
      }
    } else {
      throw usage("ui_e2e.usage.argument_unknown", "ui:e2e takes only --lane and --journey");
    }
  }
  return { lane, laneExplicit, journeys };
}

/** Whether `lane` runs journeys of `journeyLane`; the provider lane only when named explicitly. */
export function laneIncludes(lane: UiE2eLaneSelection, journeyLane: UiE2eJourneyLane): boolean {
  return lane === "all" || lane === journeyLane;
}

export type UiE2eSelection = Readonly<{
  lane: UiE2eLaneSelection;
  /** Every journey, in run order, with whether this run selected it. */
  journeys: readonly Readonly<{ definition: UiE2eJourneyDefinition; selected: boolean; laneSelected: boolean }>[];
}>;

/**
 * Chooses the journeys a run selects: those named by `--journey` (or, when none
 * is named, every journey in the lane) plus their prerequisites. A named
 * journey outside the lane stays selected but has its lane unselected, which
 * the suite reports as `not_run`.
 */
export function selectUiE2eJourneys(args: Pick<UiE2eArguments, "lane" | "journeys">): UiE2eSelection {
  const named = new Set<UiE2eJourneyId>(args.journeys.length ? args.journeys : UI_E2E_JOURNEYS.filter(journey => laneIncludes(args.lane, journey.lane)).map(journey => journey.id));
  for (let grew = true; grew;) {
    grew = false;
    for (const journey of UI_E2E_JOURNEYS) {
      if (!named.has(journey.id)) continue;
      for (const required of journey.requires) if (!named.has(required)) { named.add(required); grew = true; }
    }
  }
  return {
    lane: args.lane,
    journeys: UI_E2E_JOURNEYS.map(definition => ({ definition, selected: named.has(definition.id), laneSelected: laneIncludes(args.lane, definition.lane) })),
  };
}
