import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ingestDocument } from "@/lib/rag/ingest.server";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const Route = createFileRoute("/api/upload-document")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth
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

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY missing", { status: 500 });

        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return new Response("Invalid form data", { status: 400 });
        }

        const file = formData.get("file");
        const projectId = formData.get("projectId");

        if (!file || typeof file === "string")
          return new Response("No file provided", { status: 400 });

        if (!ALLOWED_TYPES.has(file.type))
          return new Response("Unsupported file type", { status: 400 });

        const arrayBuffer = await file.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_BYTES)
          return new Response("File too large (max 10MB)", { status: 400 });

        const buffer = Buffer.from(arrayBuffer);
        const documentId = crypto.randomUUID();
        const storagePath = `${userId}/${documentId}/${file.name}`;

        // Upload to Supabase Storage
        const { error: storageErr } = await supabaseAdmin.storage
          .from("project-documents")
          .upload(storagePath, buffer, { contentType: file.type });

        if (storageErr) {
          console.error("[upload-document] storage error:", storageErr);
          return new Response("Storage upload failed", { status: 500 });
        }

        // Create DB record
        const { error: dbErr } = await supabaseAdmin
          .from("uploaded_documents")
          .insert({
            id: documentId,
            user_id: userId,
            project_id: typeof projectId === "string" ? projectId : null,
            file_name: file.name,
            file_size: buffer.byteLength,
            mime_type: file.type,
            storage_path: storagePath,
            status: "pending",
          });

        if (dbErr) {
          console.error("[upload-document] db error:", dbErr);
          return new Response("DB insert failed", { status: 500 });
        }

        // Ingest asynchronously (don't block the response)
        ingestDocument({
          documentId,
          userId,
          projectId: typeof projectId === "string" ? projectId : null,
          buffer,
          mimeType: file.type,
          lovableApiKey: key,
        }).catch((err) => console.error("[upload-document] ingest error:", err));

        return Response.json({ documentId, status: "processing" });
      },
    },
  },
});
