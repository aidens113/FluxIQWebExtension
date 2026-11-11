// Humanness in the page (W2 H3): at a level above 0, a press is aimed near its
// target's centre rather than on it, typing has a person's cadence, and a
// scroll is dwelt on. Every choice is drawn from one generator per command,
// seeded by its command id, and every pause is fitted within the command's own
// time. At 0, or when a command names no level, `commandHumanness` answers
// `undefined` and each verb takes today's path exactly: the same points, the
// same events, and no added await.

export { aimPress } from "./aim-press";
export { commandHumanness, type CommandHumanness } from "./command-humanness";
export { fitWithinCommand } from "./fit-within-command";
export { pauseFor } from "./pause-for";
export { pointNearCentre } from "./point-near-centre";
export { scrollDwellMs } from "./scroll-dwell";
export { skewedDelayMs } from "./skewed-delay";
export { standardNormal } from "./standard-normal";
export { typingGaps } from "./typing-gaps";
