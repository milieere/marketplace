export interface Rasterizer {
  /** Renders an HTML document to a PNG, or undefined when no renderer is available. */
  render(html: string, size: { width: number; height: number }): Promise<Uint8Array | undefined>;
}
