export type SourceFile = { path: string; bytes: Uint8Array };

export interface SourcePacks {
  // Paths relative to the pack root; undefined when no pack exists
  load(brandId: string): Promise<SourceFile[] | undefined>;
}
