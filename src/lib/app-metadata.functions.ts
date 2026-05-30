import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AppMetadata = {
  title: string;
  description: string;
  og_title: string;
  og_description: string;
  og_site_name: string;
  og_type: string;
  favicon_url: string;
  og_image_url: string;
  apple_touch_icon_url: string;
};

const DEFAULTS: AppMetadata = {
  title: "סוכן ניתוח מערכות — תרשימים מתוך טקסט",
  description:
    "סוכן AI לאנליסטים: הופך דרישות וטקסט חופשי לתרשימי זרימה, swim-lanes, ER ורצף — עם עריכה ויזואלית וקוד Mermaid.",
  og_title: "",
  og_description: "",
  og_site_name: "סוכן ניתוח מערכות",
  og_type: "website",
  favicon_url: "",
  og_image_url: "",
  apple_touch_icon_url: "",
};

export const getAppMetadata = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("app_metadata")
    .select("*")
    .eq("id", "singleton")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { ...DEFAULTS, ...(data ?? {}) } as AppMetadata;
});

const UpdateSchema = z.object({
  title: z.string().max(200).default(""),
  description: z.string().max(500).default(""),
  og_title: z.string().max(200).default(""),
  og_description: z.string().max(500).default(""),
  og_site_name: z.string().max(200).default(""),
  og_type: z.string().max(50).default("website"),
  favicon_url: z.string().max(2000).default(""),
  og_image_url: z.string().max(2000).default(""),
});

export const updateAppMetadata = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("app_metadata")
      .upsert({ id: "singleton", ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const GenerateSchema = z.object({
  prompt: z.string().min(3).max(1000),
  kind: z.enum(["favicon", "og"]),
});

// Generate an image via Lovable AI Gateway and upload to storage; returns public URL.
export const generateAppImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");

    const isFavicon = data.kind === "favicon";
    const enhancedPrompt = isFavicon
      ? `Create a clean, simple, recognizable app icon / favicon: ${data.prompt}. Centered subject, solid background, bold shapes, minimal detail, suitable for small sizes.`
      : `Create a social share image (landscape, 1200x630 feel): ${data.prompt}. Visually appealing, modern, suitable as Open Graph preview.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: enhancedPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("הגעת למגבלת קצב. נסה שוב בעוד רגע.");
      if (res.status === 402) throw new Error("אזלו קרדיטי ה-AI. הוסף קרדיטים בהגדרות.");
      throw new Error(`יצירת תמונה נכשלה: ${txt.slice(0, 200)}`);
    }

    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("המודל לא החזיר תמונה");
    }
    const mime = "image/png";
    const ext = "png";

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${data.kind}/${Date.now()}.${ext}`;


    const up = await supabaseAdmin.storage
      .from("app-assets")
      .upload(path, bytes, { contentType: mime, upsert: true });
    if (up.error) throw new Error(`העלאה נכשלה: ${up.error.message}`);

    const { data: pub } = supabaseAdmin.storage.from("app-assets").getPublicUrl(path);
    return { url: pub.publicUrl };
  });
