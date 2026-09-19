export interface ArtifactStore {
  put(id: string, html: string): Promise<void>;
  get(id: string): Promise<string | undefined>;
}
