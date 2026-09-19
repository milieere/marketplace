export type DocumentPage = { number: number; text: string };

export interface DocumentReader {
  // Text layer per page, 1-based page numbers
  pages(bytes: Uint8Array): Promise<DocumentPage[]>;
}
