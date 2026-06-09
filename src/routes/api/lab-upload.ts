import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BodySchema = z.object({
  sessionId: z.string().uuid(),
  fileName: z.string().min(1).max(300),
  mimeType: z.string().max(200).optional().nullable(),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  text: z.string().max(500_000),
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

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

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
            extracted_text: body.text,
          })
          .select("id, file_name, mime_type, file_size, created_at")
          .single();

        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ document: data });
      },
    },
  },
});
