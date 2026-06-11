// ============================================================
// src/routes/api/delete-document.ts
// HTTP endpoint (server route) — delete-document.ts
// נקודת קצה ציבורית/פנימית עבור TanStack Start
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BodySchema = z.object({ documentId: z.string().uuid() });

export const Route = createFileRoute("/api/delete-document")({
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
        const userId = userData.user.id;

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        // Fetch the doc to get storage path (verifies ownership via RLS)
        const { data: doc } = await supabaseAdmin
          .from("uploaded_documents")
          .select("storage_path")
          .eq("id", body.documentId)
          .eq("user_id", userId)
          .maybeSingle();

        if (!doc) return new Response("Not found", { status: 404 });

        // Delete from storage if a path exists (chunks cascade via FK on DB delete)
        if (doc.storage_path) {
          await supabaseAdmin.storage
            .from("project-documents")
            .remove([doc.storage_path]);
        }

        await supabaseAdmin
          .from("uploaded_documents")
          .delete()
          .eq("id", body.documentId)
          .eq("user_id", userId);

        return Response.json({ success: true });
      },
    },
  },
});
