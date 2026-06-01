// Client-side text extraction for RAG ingest.
// Runs in the browser so Cloudflare Workers don't need pdf-parse/mammoth.
// Heavy deps are dynamically imported only when needed.

export interface ExtractResult {
  text: string;
  charCount: number;
}

const PLAIN_TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
]);

const DOCX_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function extractTxt(file: File): Promise<string> {
  return await file.text();
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (
    await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  ).default;
  (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc: string } })
    .GlobalWorkerOptions.workerSrc = workerSrc;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: unknown) =>
        it && typeof it === "object" && "str" in it
          ? (it as { str: string }).str
          : "",
      )
      .join(" ");
    parts.push(pageText);
  }
  await doc.destroy();
  return parts.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = (await import("mammoth")) as unknown as {
    extractRawText: (opts: {
      arrayBuffer: ArrayBuffer;
    }) => Promise<{ value: string }>;
  };
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function extractTextFromFile(file: File): Promise<ExtractResult> {
  let text = "";
  if (PLAIN_TEXT_TYPES.has(file.type) || /\.(txt|md|csv)$/i.test(file.name)) {
    text = await extractTxt(file);
  } else if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    text = await extractPdf(file);
  } else if (file.type === DOCX_TYPE || /\.docx$/i.test(file.name)) {
    text = await extractDocx(file);
  } else {
    throw new Error(
      `סוג קובץ לא נתמך: ${file.type || file.name}. נתמך: TXT, MD, PDF, DOCX.`,
    );
  }

  const clean = text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
  return { text: clean, charCount: clean.length };
}

export function describeMime(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return DOCX_TYPE;
    case "txt":
      return "text/plain";
    case "md":
      return "text/markdown";
    case "csv":
      return "text/csv";
    default:
      return "application/octet-stream";
  }
}
