## הבעיה

בדף "המסמכים שלי" (`/documents`), רק כרטיסיות מסוג "מסמך" עטופות ב-`<Link>` (לעורך). כרטיסיות תרשים (וקבצים שהועלו) הן `<div>` רגיל ללא טיפול בלחיצה — לכן לחיצה על תרשים לא מציגה שום דבר. בנוסף, אין כיום ראוט להצגת תרשים בודד.

## הפתרון

1. **ראוט חדש** `src/routes/_authenticated/diagram.$id.tsx`:
   - טוען את התרשים דרך `getDiagram({ id })`.
   - מציג כותרת, סוג, ותצוגת `MermaidPreview` עם `mermaid_code`.
   - כפתור חזרה ל-`/documents`, וכפתור פתיחה/הורדה (אופציונלי SVG כמו ב-editor).
   - `errorComponent` ו-`notFoundComponent` כנדרש.

2. **`src/routes/_authenticated/documents.tsx`**:
   - לעטוף כרטיס תרשים ב-`<Link to="/diagram/$id" params={{ id: it.id }}>`.
   - לעדכן את כפתור ה-"פתח" (ExternalLink) בהובר שיופיע גם עבור תרשימים ויפנה לאותו ראוט.
   - קבצים שהועלו נשארים ללא פעולת פתיחה (כפי שזה כיום).

## הערות טכניות

- שימוש ב-`useQuery` עם `queryKey: ["diagram", id]` ו-`retry: false`, כמו בדפוס שב-`chat.$threadId.tsx`.
- אין שינויים ב-DB או ב-server functions — `getDiagram` כבר קיים ב-`src/lib/diagrams.functions.ts`.
