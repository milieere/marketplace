import { describe, expect, it } from "vitest";
import { MAX_FILES, toSourceFiles, type Upload } from "../../src/http/upload";

const bytes = (n = 4) => new Uint8Array(n);
const upload = (name: string, size?: number): Upload => ({ name, bytes: bytes(size) });
const paths = (uploads: Upload[]) => {
  const result = toSourceFiles(uploads);
  if ("problem" in result) throw new Error(`unexpected problem: ${result.problem.error}`);
  return result.files.map((f) => f.path);
};
const problem = (uploads: Upload[]) => {
  const result = toSourceFiles(uploads);
  if (!("problem" in result)) throw new Error("expected a problem");
  return result.problem;
};

describe("toSourceFiles", () => {
  it("strips the folder a dropped directory is nested in", () => {
    expect(
      paths([upload("casa-brisa/brand-guidelines.pdf"), upload("casa-brisa/offers.csv"), upload("casa-brisa/photos/terrace.jpg")]),
    ).toEqual(["brand-guidelines.pdf", "offers.csv", "photos/terrace.jpg"]);
  });

  it("keeps paths as they are when the files share no folder", () => {
    expect(paths([upload("brand-guidelines.pdf"), upload("offers.csv")])).toEqual(["brand-guidelines.pdf", "offers.csv"]);
  });

  it("never strips photos/ as if it were the drop folder", () => {
    expect(paths([upload("photos/terrace.jpg"), upload("photos/bar.jpg"), upload("guidelines.pdf")])).toEqual([
      "photos/terrace.jpg",
      "photos/bar.jpg",
      "guidelines.pdf",
    ]);
  });

  // readPack only treats an image under photos/ as a brand photo
  it("moves loose images under photos/", () => {
    expect(paths([upload("guidelines.pdf"), upload("terrace.jpg"), upload("deep/nested/bar.png")])).toEqual([
      "guidelines.pdf",
      "photos/terrace.jpg",
      "photos/bar.png",
    ]);
  });

  it("drops traversal segments instead of writing outside the pack", () => {
    expect(paths([upload("../../etc/passwd.csv"), upload("guidelines.pdf")])).toEqual(["etc/passwd.csv", "guidelines.pdf"]);
  });

  it("skips dotfiles", () => {
    expect(paths([upload(".DS_Store"), upload("guidelines.pdf")])).toEqual(["guidelines.pdf"]);
  });

  it("refuses a file type the pipeline cannot read", () => {
    expect(problem([upload("guidelines.pdf"), upload("notes.docx")])).toMatchObject({ error: "unsupported_files", detail: "notes.docx" });
  });

  it("refuses photos with no document to extract a brand from", () => {
    expect(problem([upload("photos/terrace.jpg")])).toMatchObject({ error: "no_brand_documents" });
  });

  it("refuses an empty drop", () => {
    expect(problem([])).toMatchObject({ error: "no_files" });
    expect(problem([upload(".DS_Store")])).toMatchObject({ error: "no_files" });
  });

  it("caps file count and total size", () => {
    const many = Array.from({ length: MAX_FILES + 1 }, (_, i) => upload(`doc-${i}.pdf`));
    expect(problem(many)).toMatchObject({ error: "too_many_files" });
    expect(problem([upload("huge.pdf", 26 * 1024 * 1024)])).toMatchObject({ error: "upload_too_large" });
  });
});
