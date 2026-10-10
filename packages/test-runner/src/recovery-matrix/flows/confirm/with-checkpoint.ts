// Matrix row 10: the friend-request Flow with the requests page as a
// checkpoint and a retry handler for the site's "You're going too fast"
// notice on every confirm. When a confirm is refused, the handler waits the
// notice out, closes it with OK (which confirms nothing), and sends the run
// back to the checkpoint. Which confirm the site refuses varies from run to
// run (t404's first launch had Lin's refused, the third, and a handler scoped
// to Freya's alone never matched), so the handler is for all four. Coming
// back past the confirms already made must not confirm anyone again: they are
// completed lasting acts.
//
// The notice is an `alertdialog` named by its title, so the fact needs no
// evidence handle: `dialog alertdialog "You're going too fast"`. Its
// completion check is that the dialog is gone.
import { CONFIRM_QUALIFYING } from "./qualifying.js";

export const CONFIRM_WITH_CHECKPOINT = `${CONFIRM_QUALIFYING
  .replace("step: see all friend requests", "step requests: see all friend requests\n  checkpoint: yes")
  .replace("step: confirm Amara Osei", "step amara: confirm Amara Osei")
  .replace("step: confirm Jonas Weber", "step jonas: confirm Jonas Weber")
  .replace("step: confirm Lin Zhao", "step lin: confirm Lin Zhao")
  .replace("step: confirm Freya Holm", "step freya: confirm Freya Holm")}
on retry for amara, jonas, lin, freya: the site says the run is going too fast
  when: dialog alertdialog "You're going too fast"
  step: wait until the site lets the run confirm again
    node: builtin.timing.wait
    duration: 16
    unit: seconds
  step: close the notice
    node: web.dom.click
    selector: [role="alertdialog"] [role="button"]:not([aria-label])
    consequences: none
  then: go to requests
end`;
