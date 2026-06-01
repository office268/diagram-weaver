export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "text/plain") {
    return buffer.toString("utf-8");
  }

  if (mimeType === "application/pdf") {
    // pdf-parse may export differently depending on bundler; use require as fallback
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse: (b: Buffer) => Promise<{ text: string }> = require("pdf-parse");
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
