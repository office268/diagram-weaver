import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { OUTPUT_TYPES, type OutputKey } from "@/lib/output-types";

export const suggestUserPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId?: string }) => d)
  .handler(async ({ data, context }): Promise<{ prompt: string }> => {
    const { userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    let outputLabel = "מסמך אפיון";
    let outputDescription = "";
    if (data.threadId) {
      const { data: thread } = await supabaseAdmin
        .from("chat_threads")
        .select("output_type")
        .eq("id", data.threadId)
        .eq("user_id", userId)
        .maybeSingle();
      const key = thread?.output_type as OutputKey | undefined;
      if (key && OUTPUT_TYPES[key]) {
        outputLabel = OUTPUT_TYPES[key].label;
        outputDescription = OUTPUT_TYPES[key].description;
      }
    }

    const gateway = createLovableAiGatewayProvider(apiKey);

    const sectors = [
      "מגזר פרטי עסקי",
      "מגזר ממשלתי",
      "מגזר ציבורי",
    ];
    const sector = sectors[Math.floor(Math.random() * sectors.length)];

    const system = [
      "אתה משתמש עסקי בכיר (לקוח/בעל עניין) במגזר " + sector + ", בארגון אמיתי בישראל.",
      "המשימה שלך: לכתוב בקשה אותנטית בעברית לאנליסט מערכות, שבה אתה מתאר צורך עסקי אמיתי שמערכת מידע חדשה אמורה לפתור.",
      "הבקשה צריכה להישמע כמו פנייה אמיתית של לקוח — לא של מומחה טכני.",
      "כתוב בגוף ראשון (\"אנחנו רוצים\", \"אני צריך\", \"בארגון שלנו\").",
      "כלול: רקע קצר על הארגון/היחידה, הבעיה או ההזדמנות, מה המערכת אמורה לאפשר, מי המשתמשים העיקריים, ו-2-3 דוגמאות לתרחישי שימוש.",
      "אורך: 5-10 משפטים, פסקה אחת זורמת או שתיים קצרות. בלי כותרות, בלי bullet points, בלי מספור.",
      "גוון בין דומיינים שונים בכל קריאה: בריאות, חינוך, רווחה, ביטחון, תחבורה, פיננסים, ביטוח, רשויות מקומיות, תעשייה, לוגיסטיקה, נדל\"ן, משאבי אנוש, שירות לקוחות, אכיפה, רגולציה, וכו'.",
      "אל תזכיר טכנולוגיות ספציפיות, ספקים, או מוצרים מסחריים.",
      "החזר רק את גוף הבקשה — בלי הקדמה, בלי \"הנה הבקשה\", בלי סימני ציטוט.",
      "",
      "ההקשר: המשתמש עומד לייצר \"" + outputLabel + "\" — " + outputDescription,
      "התאם את רמת הפירוט של הבקשה כך שתספק חומר גלם רלוונטי לתוצר הזה.",
    ].join("\n");

    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt: "צור בקשה חדשה ומקורית, מדומיין שלא נראה לאחרונה.",
      temperature: 1,
      maxOutputTokens: 800,
    });

    return { prompt: text.trim() };
  });
