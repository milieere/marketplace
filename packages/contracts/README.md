# @marketplace/contracts

The API contract between `apps/web` and `apps/api`: Zod schemas for requests, the event stream, and the data it carries, plus recorded event streams for mock mode.

## Run the API in mock mode

```bash
MOCK=1 npm run dev:api      # no Nebius key needed; replays recorded streams with realistic timing
MOCK=1 MOCK_SPEED=0 …       # same, without delays
```

Then set `NEXT_PUBLIC_API_URL=http://localhost:8787` in `apps/web/.env.local`.

Which recording `/v1/generate` plays depends on the text:

| Text contains | Scenario | What you get |
|---|---|---|
| "car", "weather", "code"… | `generate-out-of-domain` | `no-match` (out of domain) with example queries |
| a group of 21+ people | `generate-no-results` | `relaxed`, then `no-match` with suggestions |
| anything else | `generate-group-dinner` | 2 artifacts (Casa Brisa, Verde), one `revision` along the way |

`POST /v1/brands/ingest` always plays `ingest-casa-brisa`: steps, `finding`s, then a draft `record`.

## Endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/v1/generate` | `{ text, now?, timezone?, format? }` (JSON) | SSE stream of `AgentEvent` |
| `POST` | `/v1/brands/ingest` | multipart files (ignored in mock mode) | SSE stream of `AgentEvent` |
| `GET` | `/health` | | `{ status, mock }` |

## Consuming the stream (JavaScript)

`EventSource` only supports GET, so read the stream with `fetch`:

```js
export async function generate(text, onEvent) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`generate failed: ${res.status}`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;
    let end;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const data = buffer.slice(0, end).split("\n").find((line) => line.startsWith("data:"));
      buffer = buffer.slice(end + 2);
      if (data) onEvent(JSON.parse(data.slice(5)));
    }
  }
}
```

Render artifact HTML isolated from the app's CSS: `<iframe srcDoc={event.html} sandbox="allow-popups" />`.

## Events

Every event has a `type`. Defined in [`src/events.ts`](src/events.ts).

| `type` | When | Use it for |
|---|---|---|
| `step` | a pipeline step starts, finishes or fails (`id`, `label`, `status`, `detail?`) | the agent timeline; update the row with the same `id` |
| `intent` | the query was understood | show what the agent understood (party, budget, needs) |
| `matches` | brands chosen, with a one-line `rationale` each | placeholders for the artifacts that are coming |
| `relaxed` | a constraint was loosened to find results | "No terrace tonight, looking wider…" |
| `revision` | the agent rewrote a draft that broke a brand rule | visible self-correction |
| `artifact` | one finished artifact: `artifact` (data + trace) and `html` | the gallery |
| `no-match` | nothing can be shown; `noMatch.html` is a ready fallback page, `suggestions` are tappable | fallback screen; a suggestion re-runs the query |
| `finding` | Brand Agent extracted a fact, with `evidence` (document, page, quote) | ingest timeline |
| `record` | Brand Agent finished; the draft `BrandRecord` | brand review screen |
| `error` | something failed; the stream still ends with `done` | error toast |
| `done` | always last | stop the spinner |

## Using the schemas in JavaScript

```js
import { AgentEvent } from "@marketplace/contracts/events";
const event = AgentEvent.parse(json);   // throws if the shape is wrong
```

The recorded streams can also be imported directly, for example to build UI states without the API running:

```js
import groupDinner from "@marketplace/contracts/fixtures/generate-group-dinner";
```
