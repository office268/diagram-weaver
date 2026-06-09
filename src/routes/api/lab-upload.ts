import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
        if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        if ((raw as { mode?: string })?.mode === "update-text") {
          const body = UpdateSchema.safeParse(raw);
          if (!body.success) return new Response("Bad request", { status: 400 });
          const { error } = await supabaseAdmin
            .from("lab_documents")
            .update({ extracted_text: body.data.text?.trim() ? body.data.text : null })
            .eq("id", body.data.documentId)
            .eq("user_id", userId);
          if (error) return new Response(error.message, { status: 500 });
          return Response.json({ ok: true });
        }

        const parsed = InsertSchema.safeParse(raw);
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const body = parsed.data;

        const { data: session } = await supabaseAdmin
          .from("lab_sessions")
          .select("id")
          .eq("id", body.sessionId)
          .eq("user_id", userId)
          .maybeSingle();
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

        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ document: data });
      },
    },
  },
});
