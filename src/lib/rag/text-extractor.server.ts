export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "text/plain") {
    return buffer.toString("utf-8");
  }

  if (mimeType === "application/pdf") {
    // Import the inner module directly — pdf-parse's index.js runs debug code
    // on import that reads a test fixture from disk and crashes in bundlers.
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    const pdfParse = (mod.default ?? mod) as (b: Buffer) => Promise<{ text: string }>;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported MIME type: ${mimeType}`);
}
