// ============================================================
// src/lib/spec/export.ts
// ספריית עזר (lib) — spec-export.ts
// ============================================================
import type { SpecContent } from "@/lib/spec/schema";
import { DEFAULT_SECTION_TITLES } from "@/lib/doc-types/types";

interface ExportInput {
  title: string;
  content: SpecContent;
  userPrompt?: string;
  userNotes?: string;
  sectionOrder: string[];
  sectionTitles: Record<string, string>;
  reviewScore?: number | null;
}

function titleOf(key: string, titles: Record<string, string>): string {
  return titles[key] ?? DEFAULT_SECTION_TITLES[key] ?? key;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build a section -> markdown string body. */
function sectionMarkdown(
  key: string,
  input: ExportInput,
): string | null {
  const { content, userNotes, userPrompt } = input;
  const trim = (s: string) => (s ?? "").trim();
  switch (key) {
    case "user_prompt":
      return trim(userPrompt ?? "") || null;
    case "user_notes":
      return trim(userNotes ?? "") || null;
    case "overview":
      return trim(content.overview) || null;
    case "goals":
      return content.goals.map((g) => `- ${g.text}`).join("\n") || null;
    case "assumptions":
      return content.assumptions.map((g) => `- ${g.text}`).join("\n") || null;
    case "risks":
      return content.risks.map((g) => `- ${g.text}`).join("\n") || null;
    case "personas":
      return (
        content.personas
          .map((p) => `### ${p.name || "פרסונה"}\n\n${p.description}`)
          .join("\n\n") || null
      );
    case "functional_requirements":
      return (
        content.functional_requirements
          .map((r, i) => `### ${i + 1}. ${r.title}\n\n${r.description}`)
          .join("\n\n") || null
      );
    case "non_functional_requirements":
      return (
        content.non_functional_requirements
          .map((r, i) => `### ${i + 1}. ${r.title}\n\n${r.description}`)
          .join("\n\n") || null
      );
    case "use_cases":
      return (
        content.use_cases
          .map((u, i) => {
            const parts = [`### ${i + 1}. ${u.title}`, u.description];
            if (u.diagram?.trim()) {
              parts.push("> [תרשים Sequence — זמין במערכת]");
            }
            return parts.join("\n\n");
          })
          .join("\n\n") || null
      );
    case "architecture": {
      const desc = trim(content.architecture.description);
      const diag = trim(content.architecture.diagram ?? "");
      if (!desc && !diag) return null;
      const out: string[] = [];
      if (desc) out.push(desc);
      if (diag) out.push("> [תרשים ארכיטקטורה — זמין במערכת]");
      return out.join("\n\n");
    }
    case "data_model": {
      const desc = trim(content.data_model.description);
      const diag = trim(content.data_model.diagram ?? "");
      if (!desc && !diag) return null;
      const out: string[] = [];
      if (desc) out.push(desc);
      if (diag) out.push("> [תרשים ERD — זמין במערכת]");
      return out.join("\n\n");
    }
    default:
      return null;
  }
}

export function specToMarkdown(input: ExportInput): string {
  const out: string[] = [`# ${input.title}`];
  if (typeof input.reviewScore === "number") {
    out.push(`> ציון ביקורת: ${input.reviewScore}/10`);
  }
  for (const key of input.sectionOrder) {
    if (key === "review") continue;
    const body = sectionMarkdown(key, input);
    if (!body) continue;
    out.push(`## ${titleOf(key, input.sectionTitles)}`);
    out.push(body);
  }
  return out.join("\n\n") + "\n";
}

/** Lightweight Markdown -> HTML for export (no third-party deps). */
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];
  const flushList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };
  const flushCode = () => {
    out.push(
      `<pre data-lang="${escapeHtml(codeLang)}"><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`,
    );
    codeBuf = [];
    codeLang = "";
    inCode = false;
  };
  for (const raw of lines) {
    const line = raw;
    if (inCode) {
      if (line.startsWith("```")) {
        flushCode();
      } else {
        codeBuf.push(line);
      }
      continue;
    }
    if (line.startsWith("```")) {
      flushList();
      inCode = true;
      codeLang = line.slice(3).trim();
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      flushList();
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      flushList();
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (line.startsWith("> ")) {
      flushList();
      out.push(`<blockquote>${escapeHtml(line.slice(2))}</blockquote>`);
    } else if (line.startsWith("- ")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (line.trim() === "") {
      flushList();
      out.push("");
    } else {
      flushList();
      out.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (inCode) flushCode();
  flushList();
  return out.join("\n");
}

export function specToHtml(input: ExportInput, opts?: { wordCompatible?: boolean }): string {
  const body = markdownToHtml(specToMarkdown(input));
  const css = `
    body { font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; max-width: 780px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #111; }
    h1 { font-size: 1.9rem; border-bottom: 2px solid #e5e7eb; padding-bottom: .4rem; }
    h2 { font-size: 1.35rem; margin-top: 2rem; border-bottom: 1px solid #f1f5f9; padding-bottom: .25rem; }
    h3 { font-size: 1.05rem; margin-top: 1.25rem; }
    p, li { font-size: .95rem; }
    blockquote { border-right: 4px solid #6366f1; padding: .25rem .75rem; color: #4b5563; margin: 1rem 0; background: #f9fafb; }
    pre { background: #f3f4f6; padding: .75rem; border-radius: 6px; overflow-x: auto; direction: ltr; text-align: left; font-family: 'Consolas', monospace; font-size: .85rem; }
    ul { padding-right: 1.25rem; }
    @media print { body { margin: 0; max-width: none; } h2 { page-break-after: avoid; } pre, blockquote { page-break-inside: avoid; } }
  `;
  const wordMeta = opts?.wordCompatible
    ? `<xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml>`
    : "";
  return `<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="utf-8" /><title>${escapeHtml(input.title)}</title>${wordMeta}<style>${css}</style></head><body>${body}</body></html>`;
}

function sanitizeFilename(s: string): string {
  return (s || "מסמך").replace(/[\\/:*?"<>|]+/g, "").slice(0, 80).trim() || "מסמך";
}

function downloadBlob(filename: string, mime: string, data: string) {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadMarkdown(input: ExportInput) {
  const md = specToMarkdown(input);
  downloadBlob(`${sanitizeFilename(input.title)}.md`, "text/markdown;charset=utf-8", md);
}

export function downloadDocx(input: ExportInput) {
  // .doc HTML — Word opens this and treats it as a document.
  const html = specToHtml(input, { wordCompatible: true });
  downloadBlob(`${sanitizeFilename(input.title)}.doc`, "application/msword;charset=utf-8", html);
}

export function printAsPdf(input: ExportInput) {
  const html = specToHtml(input);
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  // Allow layout/fonts to settle before printing.
  w.addEventListener("load", () => {
    setTimeout(() => {
      w.focus();
      w.print();
    }, 200);
  });
  return true;
}

export async function copyMarkdown(input: ExportInput): Promise<boolean> {
  const md = specToMarkdown(input);
  try {
    await navigator.clipboard.writeText(md);
    return true;
  } catch {
    return false;
  }
}
