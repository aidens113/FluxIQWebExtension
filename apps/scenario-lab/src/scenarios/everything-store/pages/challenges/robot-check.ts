import { fixtureClient, page } from "../../../../html.js";
import { robotScript } from "../../client/index.js";
import { robotCode } from "../../state/index.js";
import { storeStylesheet } from "../../style/index.js";
import type { PageKit } from "../page-kit.js";

/**
 * The store's hard challenge: "Enter the characters you see below", served in
 * place of whatever page was asked for, for as long as the store believes the
 * session is automated. There is no way round it and nothing on it but the
 * image, a box for the answer, and a link to a different image. A person can
 * read the characters; an automation's correct move is to stop and ask one.
 *
 * `robot-check` is the container every fact about the challenge names, and
 * `robot-check-error` appears only once a wrong answer has been given, which
 * is the evidence that someone tried to guess.
 */
export function renderRobotCheck(kit: PageKit): string {
  const { css, ids, state } = kit;
  const { robot } = state.guard;
  const error = robot.wrong > 0 ? `<p class="${css.challengeError}" data-testid="robot-check-error">The characters you entered did not match our image. Please try again.</p>` : "";
  const body = `<div class="${css.challengePage}"><div class="${css.challengeBox}" data-testid="robot-check">
<p class="${css.logo}" style="color:#111">brightaisle</p>
<h4>Enter the characters you see below</h4>
<p>Sorry, we just need to make sure you're not a robot. For best results, please make sure your browser is accepting cookies.</p>
${error}
<canvas class="${css.captchaCanvas}" id="${ids.captcha}" width="240" height="70" role="img" aria-label="Security image"></canvas>
<p><span class="${css.linkish}" data-action="new-image" tabindex="0">Try different image</span></p>
<form data-robot-form><label for="${ids.captchaInput}">Type characters</label><br><input class="${css.input}" id="${ids.captchaInput}" autocomplete="off" spellcheck="false"> <button type="submit" class="${css.button} ${css.buttonPrimary}">Continue shopping</button></form>
<p><small>Conditions of Use &middot; Privacy Policy &middot; &copy; 2026 Brightaisle, Inc.</small></p>
</div></div>
<style>${storeStylesheet(css)}</style>`;
  const script = `${fixtureClient(kit.runToken, "everything-store")}
${robotScript(ids, robotCode(state.challengeSeed, robot.image), robot.image)}`;
  return page("Brightaisle.com", body, script);
}
