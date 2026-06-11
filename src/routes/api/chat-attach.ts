// ============================================================
// src/routes/api/chat-attach.ts
// HTTP endpoint (server route) — chat-attach.ts
// נקודת קצה ציבורית/פנימית עבור TanStack Start
// ============================================================
// Chat attachment endpoint — TXT only.
// PDF/DOCX are extracted client-side (see text-extractor.client.ts) and the
// extracted text is sent directly with the chat message, so this route is
// only kept as a safety net for plain-text uploads.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

        if (file.type !== "text/plain" && file.type !== "text/markdown") {
          return new Response(
            "סוג קובץ זה חייב להתחלץ בצד הלקוח. PDF/DOCX נשלחים כטקסט חולץ מראש.",
            { status: 400 },
          );
        }

        const ab = await file.arrayBuffer();
        if (ab.byteLength > MAX_BYTES)
          return new Response("הקובץ גדול מדי (מקסימום 10MB)", { status: 400 });

        let text = Buffer.from(ab).toString("utf-8").trim();
        const truncated = text.length > MAX_CHARS;
        if (truncated) text = text.slice(0, MAX_CHARS);

        return Response.json({
          fileName: file.name,
          size: ab.byteLength,
          text,
          truncated,
        });
      },
    },
  },
});
