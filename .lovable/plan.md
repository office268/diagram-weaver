
## מה נוסיף

כפתור חדש "Generate from prompt" (✨) שמאפשר למשתמש לתאר במילים מה הוא רוצה (למשל "תהליך הזמנה באתר מסחר עם תשלום ואישור מייל") והמערכת תייצר עבורו קוד Mermaid תקין באמצעות מודל AI.

## איפה זה יופיע

1. **דאשבורד (`/dashboard`)** — ליד הכפתור "New diagram":
   - שדה בחירת סוג תרשים (קיים) + כפתור חדש "Generate with AI"
   - לחיצה פותחת דיאלוג: textarea לתיאור + בחירת סוג תרשים + כפתור "Generate"
   - בסיום: נוצר רשומה ב-`diagrams` עם הקוד שהמודל החזיר, וניווט אוטומטי ל-editor

2. **עורך (`/editor/$id`)** — בסרגל הכלים:
   - כפתור ✨ "AI" שפותח דיאלוג קטן
   - אופציות: "Generate new" (מחליף את הקוד) או "Refine current" (משפר את התרשים הקיים לפי הנחיה — "הוסף שלב בדיקת מלאי", "פשט את התרשים", "תרגם תוויות לאנגלית")
   - תצוגה מקדימה של הקוד החדש לפני אישור (Apply / Cancel) כדי לא לאבד עבודה

## איך זה יעבוד טכנית

### Server function חדשה: `src/lib/ai-diagram.functions.ts`
- `generateDiagramFromPrompt` — מוגנת ע"י `requireSupabaseAuth`
- קלט (Zod): `{ prompt: string (1–2000), diagram_type: string, existingCode?: string }`
- משתמשת ב-AI SDK + Lovable AI Gateway (knowledge: `ai-sdk-lovable-gateway` + `connecting-to-ai-models-tanstack`)
- מודל ברירת מחדל: `google/gemini-3-flash-preview`
- מבנה מובנה עם `Output.object` ו-Zod: `{ code: string, title: string }`
- System prompt:
  - "אתה מומחה Mermaid. החזר אך ורק קוד Mermaid תקין לסוג `${diagram_type}`. אל תעטוף ב-code fences. תמיכה ב-swim-lanes דרך subgraph בתרשים activity. תוויות יכולות להיות בעברית."
  - אם `existingCode` קיים — "ערוך את הקוד הבא לפי ההנחיה, שמור על מבנה ה-IDs כשאפשר".
- אחרי החזרה: ולידציה ב-`mermaid.parse()` בצד הלקוח לפני שמירה. אם נכשל — toast עם השגיאה ואופציה לנסות שוב.

### Helper חדש: `src/lib/ai-gateway.server.ts`
- מוגדר לפי תבנית `createLovableAiGatewayProvider` מה-knowledge.
- קורא `process.env.LOVABLE_API_KEY` בתוך ה-handler (כבר קיים בסודות).

### רישום middleware
- אין צורך בשינויי `src/start.ts` (כבר רשום `attachSupabaseAuth`).

### UI חדש
- `src/components/ai-prompt-dialog.tsx` — דיאלוג גנרי עם:
  - Textarea (max 2000)
  - Select לסוג תרשים (אם בעורך — pre-filled ונעול)
  - Checkbox "Refine current diagram" (רק בעורך)
  - לואדר בזמן יצירה + כפתור Cancel
- שילוב ב-`dashboard.tsx` ו-`editor.$id.tsx`.

### תלויות
- להוסיף: `ai`, `@ai-sdk/openai-compatible` (חסרים כרגע).
- אין שינויים ב-DB / migration / RLS.

## מה לא נכלל

- אין סטרימינג (one-shot generateText מספיק לתרשים קצר).
- אין היסטוריית פרומפטים (ניתן להוסיף בעתיד).
- אין יצירה מתמונה/סקיצה.

## תוצאה למשתמש

זרימה לדוגמה: בדאשבורד לוחץ "Generate with AI" → כותב "תהליך onboarding למשתמש חדש עם אימות מייל ובחירת תוכנית" → תוך ~3 שניות נפתח עורך עם תרשים flowchart מוכן, ניתן לערוך ידנית או לבקש refine נוסף.
