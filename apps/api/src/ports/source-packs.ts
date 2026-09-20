export type SourceFile = { path: string; bytes: Uint8Array };

export interface SourcePacks {
  // Paths relative to the pack root; undefined when no pack exists
  load(brandId: string): Promise<SourceFile[] | undefined>;
  // Uploads land beside the seeded packs so photo URLs resolve later
  save(brandId: string, files: SourceFile[]): Promise<void>;
}
