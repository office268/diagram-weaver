## הבעיה
ה-pipeline של activity diagram עבר ל-SVG (`runActivitySwimlaneOrchestrator` מחזיר `<svg>...</svg>`), אבל ב-`src/routes/api/chat-message.ts` הקוד שלאחר היצירה עדיין מתייחס לפלט כאל Mermaid:

1. `sanitizeMermaidLabels(mermaid)` מופעל על SVG ועלול לעוות אותו.
2. `getActivityMermaidValidationError(mermaid)` מחפש `flowchart RL` ב-SVG — תמיד נכשל עם השגיאה שראינו בלוגים:
   `יצירת תרשים ה-Activity נכשלה בשלב בדיקת Mermaid: חסר flowchart RL`.

לכן כל ניסיון ליצור activity diagram מסתיים בשגיאה.

## התיקון
ב-`src/routes/api/chat-message.ts` (סביב שורות 300–354), כאשר `outputType === "diagram_activity"`:

- לא להפעיל `sanitizeMermaidLabels` על הפלט (זה SVG).
- לא להפעיל `getActivityMermaidValidationError` על הפלט.
- במקום זאת להשתמש ב-`validateActivitySvg` (כבר קיים ב-`activity-diagram-pipeline.server.ts`) — אם יש violations, לזרוק `ActivityDiagramGenerationError("builder_invalid_mermaid", ...)` עם תיאור ההפרות. למעשה ה-orchestrator כבר מריץ ולידציה פנימית ב-`runValidatorAgent` + בדיקה סופית, כך שכפילות הוולידציה כאן מיותרת — מספיק להסיר את שתי הקריאות הללו עבור הענף של SVG.

ה-renderer (`ActivitySwimlaneRenderer`) כבר מזהה SVG לעומת Mermaid, אז שמירת ה-SVG בעמודה `mermaid_code` תמשיך לעבוד.

## פרטים טכניים
- שינוי הקוד בלבד בקובץ `src/routes/api/chat-message.ts`: לעטוף את שתי הקריאות הקיימות בתנאי `if (outputType !== "diagram_activity")` (או להסירן עבור הענף הזה).
- אין שינוי ב-prompts, system prompts, סכמות, ולידציה של ה-pipeline, או רף האיכות — להפך, מסירים שלב ולידציה שגוי שחוסם פלט תקין.
- אין שינוי במסד הנתונים או ב-renderer.

## בדיקה
לאחר התיקון: לנסות שוב ליצור activity diagram מתיאור של תהליך אישור בקשת חופשה — הפלט אמור להישמר ולהיות מוצג ב-`ActivitySwimlaneRenderer` כ-SVG.