import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractText } from "@/lib/rag/text-extractor.server";

const ALLOWED = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_CHARS = 60_000;

export const Route = createFileRoute("/api/chat-attach")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7).trim()
          : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { data: userData, error: userErr } =
          await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user)
          return new Response("Unauthorized", { status: 401 });

        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return new Response("Invalid form data", { status: 400 });
        }

        const file = formData.get("file");
        if (!file || typeof file === "string")
          return new Response("No file provided", { status: 400 });

        if (!ALLOWED.has(file.type))
          return new Response(
            "סוג קובץ לא נתמך. נתמכים: PDF, DOCX, TXT",
            { status: 400 },
          );

        const ab = await file.arrayBuffer();
        if (ab.byteLength > MAX_BYTES)
          return new Response("הקובץ גדול מדי (מקסימום 10MB)", { status: 400 });

        const buffer = Buffer.from(ab);
        let text = "";
        try {
          text = await extractText(buffer, file.type);
        } catch (e) {
          console.error("[chat-attach] extract failed:", e);
          return new Response("חילוץ טקסט נכשל", { status: 500 });
        }

        text = text.trim();
        const truncated = text.length > MAX_CHARS;
        if (truncated) text = text.slice(0, MAX_CHARS);

        return Response.json({
          fileName: file.name,
          size: buffer.byteLength,
          text,
          truncated,
        });
      },
    },
  },
});
