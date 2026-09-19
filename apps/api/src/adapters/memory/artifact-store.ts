import type { ArtifactStore } from "../../ports/artifact-store";

// Lost on restart; share links only need to outlive the demo session.
export function createMemoryArtifactStore(): ArtifactStore {
  const html = new Map<string, string>();
  return {
    put: async (id, value) => {
      html.set(id, value);
    },
    get: async (id) => html.get(id),
  };
}
