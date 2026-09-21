import type { StoreIds } from "../style/index.js";

/**
 * The robot check's script. The characters are drawn onto a canvas, warped,
 * rotated and crossed with noise; they are never text in the document, and
 * the script carries them only masked. A person reads them off the image. An
 * answer, right or wrong, reloads the page: right, and the store is back;
 * wrong, and a new image comes up with a warning.
 */
export function robotScript(ids: StoreIds, code: string, image: number): string {
  const masked = [...code].map((character, index) => character.charCodeAt(0) ^ ((index * 29 + image * 7 + 91) & 0x7f));
  return `const ROBOT = ${JSON.stringify({ ids, masked, image })};
${ROBOT_BODY}`;
}

const ROBOT_BODY = String.raw`
const canvas = document.getElementById(ROBOT.ids.captcha);
const context = canvas.getContext('2d');
let seed = 1013904223 + ROBOT.image * 7919;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
context.fillStyle = '#f4f1ea';
context.fillRect(0, 0, canvas.width, canvas.height);
for (let line = 0; line < 9; line += 1) {
  context.strokeStyle = 'rgba(' + Math.floor(random() * 120) + ',' + Math.floor(random() * 120) + ',' + Math.floor(random() * 120) + ',.55)';
  context.beginPath();
  context.moveTo(random() * canvas.width, random() * canvas.height);
  context.bezierCurveTo(random() * canvas.width, random() * canvas.height, random() * canvas.width, random() * canvas.height, random() * canvas.width, random() * canvas.height);
  context.stroke();
}
ROBOT.masked.forEach((value, index) => {
  const character = String.fromCharCode(value ^ ((index * 29 + ROBOT.image * 7 + 91) & 0x7f));
  context.save();
  context.translate(18 + index * 36 + random() * 6, 44 + random() * 12);
  context.rotate((random() - 0.5) * 0.7);
  context.font = (30 + Math.floor(random() * 8)) + 'px Georgia, serif';
  context.fillStyle = '#' + ['222', '3a2a18', '1c3350', '402020'][index % 4];
  context.fillText(character, 0, 0);
  context.restore();
});
for (let dot = 0; dot < 160; dot += 1) {
  context.fillStyle = 'rgba(0,0,0,' + (random() * 0.35) + ')';
  context.fillRect(random() * canvas.width, random() * canvas.height, 1.5, 1.5);
}
document.querySelector('[data-robot-form]').addEventListener('submit', async (event) => {
  event.preventDefault();
  await mutate('solve-robot-check', { answer: document.getElementById(ROBOT.ids.captchaInput).value });
  location.reload();
});
document.querySelector('[data-action="new-image"]').addEventListener('click', async () => {
  await mutate('new-robot-image', {});
  location.reload();
});
`;
