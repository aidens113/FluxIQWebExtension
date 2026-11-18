type ProofEventChannel = Pick<NodeJS.Process, "connected" | "send">;

/** Credential-free observations of the proof's owned engine process. */
export function sendHostProofEvent(event: Record<string, unknown>, channel: ProofEventChannel = process): void {
  if (!channel.connected || !channel.send) return;
  try {
    channel.send(event, (error) => {
      if (error && !closedChannel(error)) throw error;
    });
  } catch (error) {
    if (!closedChannel(error)) throw error;
  }
}

function closedChannel(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ERR_IPC_CHANNEL_CLOSED";
}
