import type { AgentEvent, RecordedStream } from "@marketplace/contracts/events";
import { setTimeout as sleep } from "node:timers/promises";

// Stops quietly when `signal` aborts (the client disconnected).
export async function* replay(stream: RecordedStream, speed: number, signal: AbortSignal): AsyncGenerator<AgentEvent> {
  for (const { delayMs, event } of stream.events) {
    if (speed > 0 && delayMs > 0) {
      try {
        await sleep(delayMs * speed, undefined, { signal });
      } catch (err) {
        if (signal.aborted) return;
        throw err;
      }
    }
    if (signal.aborted) return;
    yield event;
  }
}
