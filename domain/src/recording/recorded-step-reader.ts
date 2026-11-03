import type { AutomationStudioRecordedStepReader, TimelineEntry } from "fluxiq/automation";

// What a recorded web step means, for the build model's account of a recording
// (Core's `service/instruction-led/recording-steps.ts`, reached through this
// domain's implementation bundle). Core keeps the order, the undoing, the bounds
// and the screen over a control's own words; everything that knows how a browser
// names a control or a page event is here.

// Events that describe the page or the pointer rather than something the person did to a control.
const PASSIVE_KIND = /(focus|blur|scroll|wheel|mutat|snapshot|ready|error|tab_state|checkpoint|hover|move)/;
const ENTERING_KIND = /(input|change|type|typed|select|fill|enter|paste|upload)/;
const UNDOING_KIND = /(undo|back)/;

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function withRole(control: Record<string, unknown>): Record<string, unknown> {
  return { ...control, role: text(control.role) ?? text(control.implicitRole) };
}

function controlOf(entry: Readonly<TimelineEntry>): Record<string, unknown> | undefined {
  if (entry.type === "action") {
    const fingerprint = record(entry.target?.elementTarget?.fingerprint) ?? {};
    // The recorded action carries the control it acted on in its parameters (`element`); a stored target carries it as a fingerprint.
    const element = record(entry.parameters.element) ?? {};
    const merged = { ...element, ...fingerprint };
    return { ...merged, label: text(merged.label) ?? entry.target?.label, role: text(merged.role) ?? text(merged.implicitRole), attributes: merged.attributes };
  }
  if (entry.type === "domain_event") return withRole(record(record(entry.payload)?.element) ?? {});
  return undefined;
}

export const webRecordedStepReader: AutomationStudioRecordedStepReader = ({ kind, entry }) => {
  const control = controlOf(entry);
  if (!control || PASSIVE_KIND.test(kind)) return null;
  const attributes = record(control.attributes) ?? {};
  const entersValue = ENTERING_KIND.test(kind);
  const name = text(control.accessibleName) ?? text(control.name) ?? text(control.label);
  return {
    secret: text(attributes.type)?.toLowerCase() === "password",
    // The name, label, id, kind and autocomplete token a control is known by; Core screens them.
    identity: [attributes.autocomplete, attributes.name, attributes.id, attributes.placeholder, control.id, control.name, control.accessibleName, control.label].filter((value): value is string => typeof value === "string"),
    // A field's own text is its value, so a step that enters one is labelled by name alone.
    label: entersValue ? name : name ?? text(control.visibleText) ?? text(control.text),
    role: text(control.role),
    entersValue,
    undoes: UNDOING_KIND.test(kind)
  };
};
