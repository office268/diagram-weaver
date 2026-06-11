// ============================================================
// src/routes/api/transcribe-audio.ts
// HTTP endpoint (server route) — transcribe-audio.ts
// נקודת קצה ציבורית/פנימית עבור TanStack Start
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireBearerAuth } from "@/lib/api/auth.server";

const ALLOWED_MIME_PREFIXES = ["audio/", "video/"]; // many webm recordings come as video/webm
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

type ElevenLabsWord = {
  text: string;
  type?: string;
  speaker_id?: string | null;
  start?: number;
  end?: number;
};

type Segment = {
  speaker: string;
  start: number;
  end: number;
  text: string;
};

function buildSegments(words: ElevenLabsWord[]): Segment[] {
  const segments: Segment[] = [];
  let current: Segment | null = null;
  for (const w of words) {
    // skip non-speech tokens for segmentation purposes
    if (w.type && w.type !== "word" && w.type !== "spacing") continue;
    const speaker = w.speaker_id ?? "speaker_1";
    const text = w.text ?? "";
    const start: number =
      typeof w.start === "number" ? w.start : (current?.end ?? 0);
    const end = typeof w.end === "number" ? w.end : start;
    if (!current || current.speaker !== speaker) {
      if (current) segments.push(current);
      current = { speaker, start, end, text: text };
    } else {
      current.text += text;
      current.end = end;
    }
  }
  if (current) segments.push(current);
  // trim whitespace
  return segments
    .map((s) => ({ ...s, text: s.text.trim() }))
    .filter((s) => s.text.length > 0);
}

function formatHms(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(r).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function speakerLabel(id: string, map: Map<string, number>): string {
  if (!map.has(id)) map.set(id, map.size + 1);
  return `דובר ${map.get(id)}`;
}

function segmentsToText(segments: Segment[]): string {
  const map = new Map<string, number>();
  return segments
    .map((s) => `[${speakerLabel(s.speaker, map)}, ${formatHms(s.start)}] ${s.text}`)
    .join("\n\n");
}

export const Route = createFileRoute("/api/transcribe-audio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authResult = await requireBearerAuth(request);
        if (!authResult.ok) return authResult.response;

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey)
          return new Response("ElevenLabs is not connected", { status: 500 });

        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          return new Response("Invalid form data", { status: 400 });
        }

        const file = formData.get("file");
        const languageCode =
          (formData.get("language") as string | null)?.trim() || "heb";

        if (!file || typeof file === "string")
          return new Response("No audio file provided", { status: 400 });

        const mime = file.type || "";
        const okMime =
          mime === "" || ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p));
        if (!okMime)
          return new Response(`Unsupported file type: ${mime}`, { status: 400 });

        const sizeGuess = (file as File).size ?? 0;
        if (sizeGuess > MAX_BYTES)
          return new Response("File too large (max 100MB)", { status: 400 });

        // Forward to ElevenLabs Scribe
        const upstream = new FormData();
        upstream.append("file", file, (file as File).name || "audio");
        upstream.append("model_id", "scribe_v1");
        upstream.append("language_code", languageCode);
        upstream.append("diarize", "true");
        upstream.append("tag_audio_events", "true");
        upstream.append("timestamps_granularity", "word");

        const elRes = await fetch(
          "https://api.elevenlabs.io/v1/speech-to-text",
          {
            method: "POST",
            headers: { "xi-api-key": apiKey },
            body: upstream,
          },
        );

        if (!elRes.ok) {
          const errText = await elRes.text().catch(() => "");
          console.error(
            "[transcribe-audio] elevenlabs error",
            elRes.status,
            errText,
          );
          return new Response(
            `Transcription failed (${elRes.status}): ${errText.slice(0, 500)}`,
            { status: 502 },
          );
        }

        const payload = (await elRes.json()) as {
          text?: string;
          language_code?: string;
          words?: ElevenLabsWord[];
        };

        const segments = buildSegments(payload.words ?? []);
        const formatted =
          segments.length > 0
            ? segmentsToText(segments)
            : (payload.text ?? "").trim();

        return Response.json({
          text: payload.text ?? "",
          formatted,
          segments,
          language: payload.language_code ?? languageCode,
        });
      },
    },
  },
});
