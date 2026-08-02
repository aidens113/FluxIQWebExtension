export const webAutomationObservationExtractor = ({ event }) => ({
    observationType: event.eventType,
    ...(event.payload !== undefined ? { payload: event.payload } : {}),
    metadata: {
        domainId: event.domainId,
        eventType: event.eventType,
        ...(event.metadata ?? {})
    }
});
