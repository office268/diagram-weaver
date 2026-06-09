import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BodySchema = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(z.object({ id: z.string().uuid(), answer: z.string().max(5000) })).min(1),
});

export const Route = createFileRoute("/api/lab-answer")({
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

        const now = new Date().toISOString();
        for (const a of body.answers) {
          if (!a.answer.trim()) continue;
          await supabaseAdmin
            .from("lab_questions")
            .update({ answer: a.answer.trim(), answered_at: now })
            .eq("id", a.id)
            .eq("session_id", body.sessionId)
            .eq("user_id", userId);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
