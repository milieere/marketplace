import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { RecordedStream } from "@marketplace/contracts/events";

async function load(scenario: string): Promise<RecordedStream> {
  try {
    const url = import.meta.resolve(`@marketplace/contracts/fixtures/${scenario}`);
    return RecordedStream.parse(JSON.parse(await readFile(fileURLToPath(url), "utf8")));
  } catch (err) {
    throw new Error(`Cannot load recorded stream "${scenario}"`, { cause: err });
  }
}

export type RecordedStreams = {
  pickGenerate(text: string): RecordedStream;
  ingest: RecordedStream;
};

export async function loadRecordedStreams(): Promise<RecordedStreams> {
  try {
    const [outOfDomain, noResults, groupDinner, ingest] = await Promise.all([
      load("generate-out-of-domain"),
      load("generate-no-results"),
      load("generate-group-dinner"),
      load("ingest-casa-brisa"),
    ]);
    const specific = [outOfDomain, noResults];

    return {
      pickGenerate: (text) => specific.find((s) => new RegExp(s.match, "i").test(text)) ?? groupDinner,
      ingest,
    };
  } catch (err) {
    throw new Error("Mock mode needs the recorded streams in packages/contracts/fixtures", { cause: err });
  }
}
