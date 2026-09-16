/**
 * The FluxIQ domain the Lab's own projects belong to.
 *
 * Every project the Lab runs against is created in this domain: the isolated
 * and persistent-isolated targets both pass it to `create-project`
 * (`coordinator.ts`), and the existing target refuses a project bound to
 * anything else (`existing-flow-run.ts`). It is the lane's default when the
 * caller did not read the project itself; a caller that did passes that
 * project's own `domainId` instead.
 *
 * It is a literal here rather than an import because the value the domain
 * package holds — `WEB_AUTOMATION_DOMAIN_ID` in `domain/src/constants.ts` — is
 * not exported from `@fluxiq-web-extension/domain`, and reaching into the
 * package past its barrel would be worse than repeating five words. If the
 * domain ever renames itself, every literal in this package changes with it
 * and this comment is where to start.
 */
export const LAB_PROJECT_DOMAIN_ID = "web-automation";
