import { extractText, getDocumentProxy } from "unpdf";
import type { DocumentReader } from "../../ports/document-reader";

export function createPdfReader(): DocumentReader {
  return {
    async pages(bytes) {
      try {
        // pdf.js detaches the buffer it is given
        const pdf = await getDocumentProxy(new Uint8Array(bytes));
        const { text } = await extractText(pdf, { mergePages: false });
        return text.map((t, i) => ({ number: i + 1, text: t }));
      } catch (err) {
        throw new Error("Cannot read PDF text layer", { cause: err });
      }
    },
  };
}
