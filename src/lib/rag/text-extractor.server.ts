// Server-side extractor: TXT only.
// PDF/DOCX extraction runs in the browser (see text-extractor.client.ts) —
// pdf-parse/mammoth are not reliable in the Worker SSR runtime.
export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return buffer.toString("utf-8");
  }
  throw new Error(
    `חילוץ טקסט עבור ${mimeType} חייב להתבצע בצד הלקוח. שלח טקסט גולמי במקום הקובץ.`,
  );
}
