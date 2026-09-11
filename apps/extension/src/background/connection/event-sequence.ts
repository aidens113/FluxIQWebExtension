// Sequence numbers for events the background worker originates itself.

export class EventSequence {
  private counter = 0;

  // Event IDs include this sequence. Date.now() alone collides when related
  // startup events are emitted in the same millisecond.
  next(): number {
    this.counter = (this.counter + 1) % 1_000;
    return Date.now() * 1_000 + this.counter;
  }
}
