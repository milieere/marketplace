import { AgentEvent } from "@marketplace/contracts/events";

const DEFAULT_API_URL = "http://localhost:8787";

export function getApiUrl() {
  return process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
}

function readDataLine(block) {
  return block
    .split("\n")
    .find((line) => line.startsWith("data:"))
    ?.slice("data:".length)
    .trim();
}

export async function streamGenerate({ text, format = "card" }, { signal, onEvent } = {}) {
  const response = await fetch(`${getApiUrl()}/v1/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, format }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Generate failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }

  if (!response.body) {
    throw new Error("Generate response did not include a stream");
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;

    buffer += value;
    let end = buffer.indexOf("\n\n");

    while (end >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);

      const data = readDataLine(block);
      if (data) {
        onEvent?.(AgentEvent.parse(JSON.parse(data)));
      }

      end = buffer.indexOf("\n\n");
    }
  }
}
