# עורך תרשימי Mermaid — תוכנית בנייה

עורך תרשימים משולב: עריכת קוד Mermaid בצד אחד, תצוגה חיה מרונדרת בצד שני, ויכולת ליצור/לערוך אלמנטים גם ויזואלית (גרירה, הוספה, עריכת תוויות). תרשימים נשמרים בענן עם משתמשים.

## מסכים וניווט

- `/` — דף נחיתה קצר עם CTA להתחברות/התחלה.
- `/login` — התחברות/הרשמה (Email+Password וגם Google).
- `/dashboard` — רשימת התרשימים של המשתמש: יצירה, פתיחה, שכפול, מחיקה, שינוי שם.
- `/editor/$id` — מסך העורך הראשי (שלוש פאנלים: כלים | קנבס ויזואלי | קוד Mermaid).
- `/reset-password` — שחזור סיסמה.

## מסך העורך — חוויית משתמש

פריסה רספונסיבית עם 3 אזורים (במובייל: טאבים בין "ויזואלי" ל"קוד"):

1. **סרגל כלים שמאלי**
   - בחירת סוג תרשים: Flowchart, Sequence, Class, State, ER, Gantt, Activity (swim-lanes).
   - כפתורי הוספה: צומת, חץ/קשר, נתיב (swim-lane).
   - Undo/Redo, Zoom, Fit-to-screen.
   - ייצוא: SVG, JPG/PNG, קובץ `.mmd`.
   - שמירה אוטומטית + סטטוס "נשמר".

2. **קנבס ויזואלי (אמצע)**
   - רינדור חי של ה-SVG שמייצר Mermaid.
   - לחיצה על צומת → בחירה + פתיחת פאנל מאפיינים (תווית, צורה, צבע, swim-lane).
   - גרירה למיקום (overlay מעל ה-SVG עם מיפוי id→position).
   - לחיצה כפולה על תווית לעריכה מהירה.
   - חיבור צמתים: לחיצה על "+ קשר" ואז על שני צמתים.

3. **עורך קוד (ימין)**
   - Textarea עם syntax highlight (CodeMirror 6 + שפת Mermaid).
   - דו-כיווני: שינוי בקוד → רינדור מיידי בקנבס; שינוי ויזואלי → עדכון הקוד.
   - הצגת שגיאות פרסור מתחת.

## ארכיטקטורת דו-כיוון (ויזואלי ↔ קוד)

לב המערכת — מודל ביניים (AST) שמסונכרן בין שני הצדדים:

```text
        [Mermaid Code]
              │  parse
              ▼
        [Diagram Model]  ◄────────  [Visual Edits]
              │  serialize                   ▲
              ▼                              │
   [Mermaid render → SVG] ───────────────────┘
        (clicks/drag map back to model node ids)
```

- **Parser**: שימוש ב-`mermaid.parse()` להעלאת ה-AST, ומעטפת שמרכיבה ממנו `DiagramModel` (nodes, edges, lanes, metadata).
- **Serializer**: פונקציה שממירה את `DiagramModel` חזרה לטקסט Mermaid תקין (מסודר ועקבי).
- **Renderer**: `mermaid.render()` שמחזיר SVG; הזרקת `data-node-id` לפי ה-AST כדי לאפשר לכידת קליקים/גרירה.
- מצב גרירה נשמר כ-positions אופציונליים במטא-דאטה של המסמך (Mermaid לא תומך במיקומים מוחלטים בכל סוגי התרשימים — נשתמש בהם להצגה ולא בייצוא הקוד).

## סוגי תרשימים נתמכים

כל סוגי Mermaid יזוהו וירונדרו. עריכה ויזואלית מלאה (גרירה/הוספה) ב-Flowchart, Sequence, State, Class, ER, Gantt, ו-Activity עם swim-lanes (באמצעות תחביר Flowchart עם `subgraph` לכל lane).

## Backend — Lovable Cloud

הפעלת Lovable Cloud עם:

- **Auth**: Email/Password + Google.
- **טבלת `profiles`** (id FK ל-auth.users, display_name, avatar_url, created_at) + טריגר ליצירה אוטומטית.
- **טבלת `diagrams`**:
  - `id uuid pk`, `user_id uuid fk auth.users`, `title text`, `code text`, `diagram_type text`, `positions jsonb`, `created_at`, `updated_at`.
  - RLS: כל משתמש רואה/עורך רק את התרשימים שלו.
- שמירה אוטומטית דרך `createServerFn` עם `requireSupabaseAuth` (debounced).
- כל הקריאות דרך server functions — לא ישירות מה-client.

## ייצוא

- **SVG**: לקיחת ה-SVG המרונדר והורדה כקובץ.
- **JPG**: ציור ה-SVG ל-`<canvas>` והמרה ל-Blob.
- **Mermaid (.mmd)**: הורדת הטקסט הגולמי.

## פירוט טכני

- **חבילות חדשות**: `mermaid`, `@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `codemirror`, `@uiw/react-codemirror`, `@codemirror/lang-markdown` (כבסיס ל-highlight ל-Mermaid), `zod`.
- **State**: Zustand לעורך (מודל, selection, undo stack).
- **Undo/Redo**: stack של snapshots של ה-Model.
- **דיבאונס שמירה**: 800ms אחרי שינוי אחרון.
- **ניתוב**: Routes ב-TanStack — `_authenticated/dashboard.tsx`, `_authenticated/editor.$id.tsx`, `login.tsx`, `reset-password.tsx`, `index.tsx`.
- **גרירה**: שכבת overlay שקופה מעל ה-SVG עם DOM nodes לכל צומת (מבוסס על bbox מה-SVG), `pointer-events` רק עליהם.
- **שגיאות**: ErrorBoundary לכל route + הצגת שגיאות פרסור Mermaid באופן ידידותי.

## עיצוב

- מינימליסטי, מקצועי. ערכת נושא בהירה + כהה (toggle).
- כל הצבעים דרך semantic tokens ב-`src/styles.css` (oklch).
- פונט: Inter לטקסט, JetBrains Mono לעורך הקוד.

## מה לא נכלל בגרסה ראשונה

- שיתוף ציבורי של תרשימים / לינקים לצפייה (אפשר להוסיף בהמשך).
- שיתוף פעולה בזמן אמת.
- היסטוריית גרסאות מעבר ל-undo מקומי.
