// ============================================================
// src/routes/api/lab-delete.ts
// HTTP endpoint (server route) — lab-delete.ts
// נקודת קצה ציבורית/פנימית עבור TanStack Start
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireBearerAuth } from "@/lib/api/auth.server";

const BodySchema = z.object({
  target: z.enum(["document", "question", "session"]),
  id: z.string().uuid(),
});

export const Route = createFileRoute("/api/lab-delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authResult = await requireBearerAuth(request);
        if (!authResult.ok) return authResult.response;
        const { userId } = authResult;

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const table =
          body.target === "document"
            ? "lab_documents"
            : body.target === "question"
              ? "lab_questions"
              : "lab_sessions";

        const { error } = await supabaseAdmin
          .from(table)
          .delete()
          .eq("id", body.id)
          .eq("user_id", userId);

        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
