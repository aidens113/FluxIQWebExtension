// Describing one element (t223): `web.describe_element` prints everything the
// capture holds about one element. The page-wide search that once sat beside
// it is retired (page-diff D15); the full page is requested through Core's
// page channel instead.

export { webLlmDescribeElement, type WebLlmDescribeResult } from "./description";
export { WEB_LLM_DESCRIBE_SCHEMA_VERSION } from "./description-schema-version";
export { runWebDescribeElement, type WebDescribeElementRun } from "./run-description";
