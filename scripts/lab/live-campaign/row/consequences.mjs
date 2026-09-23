// What a build's own steps said they would lastingly do, who allowed it, and
// what happened when nobody had.
//
// This is the half of a campaign row that says whether a result is about the
// product. A build that reaches for a lasting act nobody permitted stops and
// asks a person; in a campaign nobody answers, so the build parks and its
// proposal can never be reviewed. Read as an HTTP failure that was
// `environment.missing` -- a verdict about the installation, for the product
// doing exactly what it was built to do (`run-mudt5jr5-92321d8c`).
//
// Two readings have to stay apart, and `answeredBy` is where they do.
//
// - `instruction`: the person's own words asked for the class, Core read them
//   that way, and the build went ahead without anybody being asked. This is
//   the ordinary case and needs no grant at all.
// - `campaign`: the task declared the class on itself (`permits`), so the
//   run's grant held it. The corpus's second opinion, for when Core's reading
//   of the instruction and the model's declaration disagree.
// - `nobody`: neither held it. The build asked and was not answered.
// - `nothing lasting`: every action said it would cause nothing that stays, so
//   there was never anything to permit.
// - `not recorded`: Core published no declarations for this build at all, which
//   is a Core too old to keep them and not a build that declared nothing.

const CONSEQUENCE = /^[a-z][a-z_]{0,40}$/u;
const VERB = /^[a-z]+(?: [a-z]+)?$/u;
/** A closed word Core writes with no spaces, such as `flow_step` or `button`. */
const WORD = /^[a-z][a-z_]{0,40}$/u;
/** How many declarations a row carries in full. Past it the counts still hold; the list is cut. */
const MAX_LISTED_ACTIONS = 40;

/**
 * The row's `consequences`, or `null` for a run that reached no build record.
 *
 * @param {Record<string, unknown> | null | undefined} liveLlm the run's `snapshots/live-llm.json`
 */
export function consequenceSummary(liveLlm) {
  const build = liveLlm?.build;
  if (!build || typeof build !== "object") return null;
  const declared = Array.isArray(build.declaredConsequences) ? build.declaredConsequences : null;
  const instructed = classesOf(Array.isArray(build.instructedConsequences) ? build.instructedConsequences.map((entry) => entry?.consequence) : []);
  const granted = classesOf(liveLlm?.granted?.permittedConsequences ?? []);
  const request = build.permissionRequest && typeof build.permissionRequest === "object" ? build.permissionRequest : null;
  const crossCheck = build.consequenceCrossCheck && typeof build.consequenceCrossCheck === "object" ? build.consequenceCrossCheck : null;
  const lasting = declared === null ? [] : declared.filter((entry) => classesOf(entry?.consequences).length > 0);
  return {
    /** How the run's permission question was answered, or that there was none to answer. */
    answeredBy: declared === null ? "not recorded" : answeredBy({ request, lasting, instructed, granted }),
    /** What the task's own run was granted, which is what its `permits` asked for. */
    granted,
    /** What Core read the person's instruction as asking for. */
    instructed,
    /** Every class any action declared for itself. */
    declared: classesOf(lasting.flatMap((entry) => entry.consequences)),
    /** How many actions were put to the gate, and how many said they would cause nothing lasting. */
    actions: declared === null ? null : declared.length,
    declaredNothing: declared === null ? null : declared.length - lasting.length,
    /** Core's reading of the declarations against the instruction: `undeclared` is the one nothing else catches. */
    crossCheckVerdict: typeof crossCheck?.verdict === "string" ? crossCheck.verdict : null,
    crossCheckUndeclared: classesOf(crossCheck?.undeclared ?? []),
    /** The question the build carried out to a person and nobody answered. */
    permissionRequest: request === null ? null : {
      verb: verbOf(request.verb),
      controlKind: wordOf(request.controlKind),
      consequences: classesOf(request.consequences),
      missing: classesOf(request.missing),
    },
    /** The acting steps that declared something lasting, so a reader can see what the Flow would do. */
    lastingActions: lasting.slice(0, MAX_LISTED_ACTIONS).map((entry) => ({
      actionKind: wordOf(entry.actionKind),
      verb: verbOf(entry.verb),
      consequences: classesOf(entry.consequences),
      permitted: entry.permitted === true,
    })),
  };
}

/**
 * Nothing lasting was declared, or the classes that were came from the
 * instruction, from the campaign's own grant, or from neither.
 *
 * A class held by both reads as `instruction`: the instruction is the
 * authority, and the grant only ever agrees with it.
 */
function answeredBy({ request, lasting, instructed, granted }) {
  if (request !== null) return "nobody";
  if (lasting.length === 0) return "nothing lasting";
  const classes = classesOf(lasting.flatMap((entry) => entry.consequences));
  if (classes.every((entry) => instructed.includes(entry))) return "instruction";
  if (classes.every((entry) => instructed.includes(entry) || granted.includes(entry))) return "campaign";
  // Permitted, and neither list explains it. Worth seeing rather than guessing.
  return "unexplained";
}

/** The consequence classes in a value, deduplicated and in the order they appear: closed words only, never free text. */
function classesOf(value) {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.filter((entry) => typeof entry === "string" && CONSEQUENCE.test(entry)))];
}

/** The verb Core recorded for an action: one or two lowercase words, never a sentence. */
function verbOf(value) {
  return typeof value === "string" && VERB.test(value) ? value : null;
}

/** One of Core's own closed words, such as an action kind or a control kind; anything else is withheld. */
function wordOf(value) {
  return typeof value === "string" && WORD.test(value) ? value : null;
}
