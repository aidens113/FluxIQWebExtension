// The non-cryptographic hash the state digest (`../llm-evidence/state-digest/`)
// and the route signature and step effect (`../route-state/`) are made of. A
// leaf of its own, importing nothing, so the route-state effect a build records
// for an act (`../llm-evidence/plan-resolution/act-effect.ts`, t447) can be
// signed from inside the evidence runtime without closing a module cycle
// through the state digest's barrel.
export { fnv1a } from "./fnv1a";
