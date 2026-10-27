// The control a press is delivered to. `pressable-host.ts` is the one selector
// for it, read by the press guard and the actionability gate; `same-control-hit.ts`
// says when a point that missed a target still reaches the control the target is
// part of, as a press on a photo through its cell's hover overlay does.

export { PRESSABLE_HOST } from "./pressable-host";
export { sameControlHit } from "./same-control-hit";
