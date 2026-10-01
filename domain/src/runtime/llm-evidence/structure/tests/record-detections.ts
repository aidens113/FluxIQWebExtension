// Detection answers that read one record, written from the scenarios' markup.
//
// **Unlike `captured-detections.ts`, these were not captured**: the content
// script that answers them (`apps/extension/src/content/extraction/single-record/`,
// t195 w20i) has not yet been run in a browser, and this lane runs none. Each is
// written from the markup the scenario emits and the rules the producer follows
// (`infer-fields.ts`'s path steps, `key-value-record.ts`'s `dd:nth-of-type`),
// in the wire shape `webAutomationStructureDetectionValue` reads. Replace them
// with captures once the content harness can produce them; the recipe is in
// `captured-detections.ts`.
//
// - **photo-social, a message thread after the moon-jar reply**
//   (`apps/scenario-lab/src/scenarios/photo-social/pages/direct.ts`, seed 238,
//   class names from `photoLook(238).cls`). Aimed at the reply card, the page
//   finds the inbox's three thread rows outward (`a.<threadRow>`: avatar, name,
//   preview -- no price) and sends the card itself beside them as `record`: the
//   card's inner `div`, whose three spans are the piece's name, its price and a
//   note. The two class-less spans are named by position, the classed one by its
//   first three classes in order, as `pathStep` names them.
// - **job-board, the application receipt in the confirmation frame**
//   (`apps/scenario-lab/src/scenarios/job-board/ats/embed-pages.ts`,
//   `renderConfirmation`). A bare `<dl class="tl-receipt">` of four `dt`/`dd`
//   pairs is answered as the proposal itself, one item, each field read from
//   its pair's `dd` and labelled by its `dt`.

import type { CapturedDetection } from "./captured-detections";

/** The reply card's item and its three spans, as the record proposal names them. */
export const REPLY_CARD = {
  item: "a.x1q2ucds.x1rgczww.x1ui8mjl > div",
  name: ":scope > span:nth-of-type(1)",
  price: ":scope > span:nth-of-type(2)",
  note: ":scope > span.x1s0c7au.x1xkdpo7.xdd3vo9"
} as const;

/** The card link a model is shown on the thread page, and aims the detection at. */
export const REPLY_CARD_LINK = {
  tagName: "a",
  selector: "a.x1q2ucds.x1rgczww.x1ui8mjl",
  visibleText: "Speckled moon jar €68.00 One of one · ships in 3–5 days",
  href: "/scenarios/photo-social/saltmarsh.goods/shop/speckled-moon-jar/"
} as const;

export const RECORD_DETECTIONS = {
  "photo-social-reply-card": {
    url: "http://127.0.0.1:4173/scenarios/photo-social/direct/t/saltmarsh.goods/",
    title: "Saltmarsh Goods • Direct",
    structure: {
      ok: true,
      proposal: {
        container: "aside.x1prjgkc.x1v2hafg.xroa8j4",
        item: "a.x1ui8mjl.x1unrdkg.x1xae3z8",
        itemCount: 3,
        fields: [
          {
            key: "img_x1rqcllv_x1sabszt_x1t4am2q_alt",
            label: "img.x1rqcllv.x1sabszt.x1t4am2q alt",
            spec: { kind: "attribute", selector: ":scope > img.x1rqcllv.x1sabszt.x1t4am2q", attribute: "alt", required: true },
            coverage: 1
          },
          {
            key: "div_div_x1rqcllv_x2u6nzd_xox4giq",
            label: "div > div.x1rqcllv.x2u6nzd.xox4giq",
            spec: { kind: "text", selector: ":scope > div > div.x1rqcllv.x2u6nzd.xox4giq", required: true },
            coverage: 1
          },
          {
            key: "div_div_x1s0c7au_x1xkdpo7_xdd3vo9",
            label: "div > div.x1s0c7au.x1xkdpo7.xdd3vo9",
            spec: { kind: "text", selector: ":scope > div > div.x1s0c7au.x1xkdpo7.xdd3vo9", required: true },
            coverage: 1
          }
        ],
        confidence: 0.9
      },
      record: {
        container: "a.x1q2ucds.x1rgczww.x1ui8mjl",
        item: REPLY_CARD.item,
        itemCount: 1,
        fields: [
          { key: "span_1", label: "span:1", spec: { kind: "text", selector: REPLY_CARD.name, required: true }, coverage: 1 },
          { key: "span_2", label: "span:2", spec: { kind: "text", selector: REPLY_CARD.price, required: true }, coverage: 1 },
          {
            key: "span_x1s0c7au_x1xkdpo7_xdd3vo9",
            label: "span.x1s0c7au.x1xkdpo7.xdd3vo9",
            spec: { kind: "text", selector: REPLY_CARD.note, required: true },
            coverage: 1
          }
        ],
        confidence: 0.5
      }
    }
  },
  "job-board-receipt": {
    url: "http://127.0.0.1:4999/scenarios/job-board/embed/confirmation?app=app-1",
    title: "Application received",
    structure: {
      ok: true,
      proposal: {
        container: "main.tl",
        item: "dl.tl-receipt",
        itemCount: 1,
        fields: [
          { key: "role", label: "Role", spec: { kind: "text", selector: ":scope > dd:nth-of-type(1)", required: true }, coverage: 1 },
          { key: "company", label: "Company", spec: { kind: "text", selector: ":scope > dd:nth-of-type(2)", required: true }, coverage: 1 },
          { key: "reference", label: "Reference", spec: { kind: "text", selector: ":scope > dd:nth-of-type(3)", required: true }, coverage: 1 },
          { key: "submitted", label: "Submitted", spec: { kind: "text", selector: ":scope > dd:nth-of-type(4)", required: true }, coverage: 1 }
        ],
        confidence: 1
      }
    }
  }
} satisfies Record<string, CapturedDetection>;

export type RecordDetectionName = keyof typeof RECORD_DETECTIONS;
