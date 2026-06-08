import type { DocTypeKey } from "@/lib/doc-types";

export interface DocTemplate {
  /** Short label shown on the chip. */
  label: string;
  /** Pre-filled prompt that goes into the textarea when selected. */
  prompt: string;
}

/**
 * Starter templates per document type. Picking a template prefills the
 * prompt textarea — the user can edit it further before generation.
 */
export const DOC_TEMPLATES: Record<DocTypeKey, DocTemplate[]> = {
  business_requirements: [
    {
      label: "אפליקציית B2C",
      prompt:
        "אפליקציית מובייל לצרכנים בתחום ה[X]. אפיינו את הצורך העסקי, קהל היעד, פיצ'רים מרכזיים, מודל הכנסות (Subscription/Freemium), KPIs מרכזיים (DAU/Retention/LTV) וסיכונים עסקיים.",
    },
    {
      label: "פלטפורמת SaaS B2B",
      prompt:
        "פלטפורמת SaaS לארגונים בתחום ה[X]. כללו את בעיית הלקוח, ICP (Ideal Customer Profile), Pricing tiers, אינטגרציות נדרשות (CRM/ERP), KPIs (MRR, Churn, NRR) ומסע לקוח.",
    },
    {
      label: "מערכת פנים-ארגונית",
      prompt:
        "מערכת פנים-ארגונית לייעול תהליך [X] בחברה. תארו את התהליך הקיים, נקודות כאב, בעלי עניין מרכזיים, יעדים מדידים, ROI צפוי ואינטגרציות למערכות הליבה.",
    },
  ],
  technical_requirements: [
    {
      label: "REST API + DB",
      prompt:
        "REST API לתחום ה[X] עם בסיס נתונים יחסי. פרטו endpoints מרכזיים, סכמת נתונים, אימות (JWT/OAuth), Rate limiting, NFRs (latency<200ms, 99.9% uptime), ואינטגרציות חיצוניות.",
    },
    {
      label: "מיקרו-שירותים",
      prompt:
        "ארכיטקטורת מיקרו-שירותים ל[X]. כללו פירוט שירותים, תקשורת ביניהם (REST/gRPC/Event-driven), שירות messaging (Kafka/RabbitMQ), Service discovery, Observability ו-Deployment (K8s).",
    },
    {
      label: "Realtime Streaming",
      prompt:
        "מערכת זמן-אמת לעיבוד אירועי [X] בהיקף גבוה. תארו את ה-ingestion, pipeline (Kafka/Flink), אחסון (TSDB/OLAP), זמני תגובה, throughput נדרש ו-fault tolerance.",
    },
  ],
  initiation: [
    {
      label: "MVP בסטארטאפ",
      prompt:
        "מסמך ייזום ל-MVP של מוצר [X]. כללו רקע, הזדמנות שוק, יעדים, היקף MVP, צוות חסר, אבני דרך לתשעה חודשים, תקציב גס וסיכונים מרכזיים.",
    },
    {
      label: "פרויקט שדרוג מערכת",
      prompt:
        "פרויקט החלפה/שדרוג של מערכת [X] קיימת. כללו מצב נוכחי, פערים, רציונל, היקף, אסטרטגיית מעבר (Big bang/Phased), אבני דרך, תלויות וסיכונים.",
    },
    {
      label: "Discovery קצר",
      prompt:
        "פרויקט Discovery בן 4 שבועות לבחינת הכדאיות של [X]. כללו שאלות מחקר, deliverables, צוות, מתודולוגיה, אבני דרך שבועיות ו-Definition of Success.",
    },
  ],
  spec_overview: [
    {
      label: "פלטפורמת מסחר",
      prompt:
        "פלטפורמת מסחר אונליין למוצרי [X]. כללו ניהול קטלוג, סל קניות, תשלום (Stripe/PayPal), ניהול הזמנות, חשבון משתמש, ופנל אדמין.",
    },
    {
      label: "כלי ניהול משימות",
      prompt:
        "כלי ניהול משימות לצוותים קטנים. כללו פרויקטים, משימות, תיוגים, הקצאה, סטטוסים, תצוגת Kanban/Calendar, הרשאות ו-notifications.",
    },
    {
      label: "פורטל לקוחות",
      prompt:
        "פורטל לקוחות לחברת שירות. כללו הרשמה/התחברות, צפייה בחשבונות וחיובים, פתיחת קריאות שירות, צ'אט עם נציג ו-self-service knowledge base.",
    },
  ],
  spec_detailed: [
    {
      label: "Onboarding flow",
      prompt:
        "אפיון מפורט של תהליך Onboarding למשתמש חדש: רישום, אימות אימייל/SMS, OAuth, מילוי פרופיל, בחירת תוכנית, hand-off ל-product tour. כללו states, edge cases ותרחישי שימוש מפורטים.",
    },
    {
      label: "תהליך תשלום",
      prompt:
        "אפיון מפורט של checkout: סל קניות, חישוב מחיר ומס, הזנת כתובת, בחירת אמצעי תשלום, אישור, retry על כשלון. כללו state machine, מודל נתונים מלא ו-error handling.",
    },
    {
      label: "מודול דוחות",
      prompt:
        "מודול דוחות וניתוח: בחירת פרמטרים, ביצוע query, רינדור טבלאות וגרפים, ייצוא PDF/CSV, תזמון דוחות תקופתיים. כללו מודל נתונים, ארכיטקטורה ותרחישי שימוש מפורטים.",
    },
  ],
};
