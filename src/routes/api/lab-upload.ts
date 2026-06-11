// ============================================================
// src/routes/api/lab-upload.ts
// HTTP endpoint (server route) — lab-upload.ts
// נקודת קצה ציבורית/פנימית עבור TanStack Start
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireBearerAuth } from "@/lib/api/auth.server";

const InsertSchema = z.object({
  mode: z.literal("insert").optional(),
  sessionId: z.string().uuid(),
  fileName: z.string().min(1).max(300),
  mimeType: z.string().max(200).optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  text: z.string().max(500_000).optional().nullable(),
});

const UpdateSchema = z.object({
  mode: z.literal("update-text"),
  documentId: z.string().uuid(),
  text: z.string().max(500_000).optional().nullable(),
});

export const Route = createFileRoute("/api/lab-upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authResult = await requireBearerAuth(request);
        if (!authResult.ok) return authResult.response;
        const { userId } = authResult;

        let raw: unknown;
        try {
          raw = await request.json();
          console.info("[lab-upload][server] body:parsed", {
            mode:
              raw && typeof raw === "object" && "mode" in raw && typeof raw.mode === "string"
                ? raw.mode
                : "insert",
          });
        } catch {
          console.error("[lab-upload][server] body:parse-failed");
          return new Response("Bad request", { status: 400 });
        }

        if ((raw as { mode?: string })?.mode === "update-text") {
          const body = UpdateSchema.safeParse(raw);
          console.info("[lab-upload][server] update-text:validate", {
            success: body.success,
          });
          if (!body.success) return new Response("Bad request", { status: 400 });
          const { error } = await supabaseAdmin
            .from("lab_documents")
            .update({ extracted_text: body.data.text?.trim() ? body.data.text : null })
            .eq("id", body.data.documentId)
            .eq("user_id", userId);
          console.info("[lab-upload][server] update-text:db", {
            documentId: body.data.documentId,
            hasText: Boolean(body.data.text?.trim()),
            error: error?.message ?? null,
          });
          if (error) return new Response(error.message, { status: 500 });
          return Response.json({ ok: true });
        }

        const parsed = InsertSchema.safeParse(raw);
        console.info("[lab-upload][server] insert:validate", {
          success: parsed.success,
        });
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const body = parsed.data;

        const { data: session } = await supabaseAdmin
          .from("lab_sessions")
          .select("id")
          .eq("id", body.sessionId)
          .eq("user_id", userId)
          .maybeSingle();
        console.info("[lab-upload][server] session:lookup", {
          sessionId: body.sessionId,
          found: Boolean(session),
        });
        if (!session) return new Response("Session not found", { status: 404 });

        const { data, error } = await supabaseAdmin
          .from("lab_documents")
          .insert({
            session_id: body.sessionId,
            user_id: userId,
            file_name: body.fileName,
            mime_type: body.mimeType ?? null,
            file_size: body.fileSize ?? null,
            extracted_text: body.text?.trim() ? body.text : null,
          })
          .select("id, file_name, mime_type, file_size, created_at")
          .single();

        console.info("[lab-upload][server] insert:db", {
          sessionId: body.sessionId,
          fileName: body.fileName,
          fileSize: body.fileSize ?? null,
          mimeType: body.mimeType ?? null,
          documentId: data?.id ?? null,
          error: error?.message ?? null,
        });
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ document: data });
      },
    },
  },
});
