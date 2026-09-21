import { escapeHtml, fixtureClient, page } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { ROBOT_CHECK_HOLD_MS, ROBOT_CHECK_WAIT_MS } from "../state/index.js";
import type { BigboxState } from "../types.js";
import { bigboxStylesheet } from "../theme/index.js";
import { bigboxClasses } from "../theme/index.js";

/**
 * The bot check a results page is replaced by. It is served at the address
 * that was asked for, so reloading it is asking again, and it answers every
 * results request the same way until it is passed.
 *
 * It clears honestly in either of two ways. Pressing and holding the button
 * for two seconds passes it; a click, however many, does not. Or doing
 * nothing: the page counts down and checks again by itself. Either way it
 * reloads the address it was served at, which is now the results.
 */
export function renderRobotCheckPage(state: BigboxState, context: RenderContext, reference: string): string {
  const c = bigboxClasses(state.mode, context.seed);
  const seconds = Math.round(ROBOT_CHECK_WAIT_MS / 1000);
  const body = `<style>${bigboxStylesheet(c)}</style><div class="${c.robotPage}"><div class="${c.robotCard}">
<h1>Robot or human?</h1>
<p>Activate and hold the button to confirm that you're human. Thank you!</p>
<div class="${c.holdButton}" tabindex="0"><span class="${c.holdFill}"></span><span>Press &amp; Hold</span></div>
<p class="${c.robotNote}">Having trouble? We'll check your browser again automatically in <span>${seconds}</span> seconds.</p>
<p class="${c.robotNote}">Reference ID: ${escapeHtml(reference)}</p>
</div></div>`;
  const script = `${fixtureClient(context.runToken, "bigbox-retail")}
const button = document.querySelector('.${c.holdButton}'); const fill = document.querySelector('.${c.holdFill}');
const notes = document.querySelectorAll('.${c.robotNote}'); const count = notes[0].querySelector('span');
let done = false; let started = 0; let frame = 0;
const pass = async (how) => { if (done) return; done = true; await mutate('clear-robot-check', { how }); location.reload(); };
const release = () => { if (!started || done) return; started = 0; cancelAnimationFrame(frame); fill.style.width = '0'; notes[0].firstChild.textContent = 'Please try again. Having trouble? We will check your browser again automatically in '; };
const tick = () => { if (!started) return; const held = performance.now() - started; fill.style.width = Math.min(100, held / ${ROBOT_CHECK_HOLD_MS} * 100) + '%'; if (held >= ${ROBOT_CHECK_HOLD_MS}) pass('held'); else frame = requestAnimationFrame(tick); };
const press = () => { if (started || done) return; started = performance.now(); frame = requestAnimationFrame(tick); };
button.addEventListener('pointerdown', press); button.addEventListener('pointerup', release); button.addEventListener('pointerleave', release);
button.addEventListener('keydown', (event) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); press(); } });
button.addEventListener('keyup', release);
let left = ${seconds};
const countdown = setInterval(() => { left -= 1; count.textContent = String(Math.max(0, left)); if (left <= 0) { clearInterval(countdown); pass('waited'); } }, 1000);`;
  return page("Robot or human?", body, script);
}
