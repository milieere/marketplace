import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { AgentEvent } from "@marketplace/contracts/events";

// Events must reach the client in order, so they are written one at a time.
export function streamAgentEvents(c: Context, produce: (signal: AbortSignal) => AsyncIterable<AgentEvent>) {
  return streamSSE(c, async (stream) => {
    const abort = new AbortController();
    stream.onAbort(() => abort.abort());
    try {
      for await (const event of produce(abort.signal)) {
        await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "unexpected error";
      await stream.writeSSE({ event: "error", data: JSON.stringify({ type: "error", message }) });
      await stream.writeSSE({ event: "done", data: JSON.stringify({ type: "done" }) });
    }
  });
}
