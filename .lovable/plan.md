# Update meta tags — "System Analysis Agent" positioning

Reframe the product across all routes from a generic Mermaid editor to **"System Analysis Agent"** — an AI assistant for system analysts that turns requirements into diagrams (flows, swim-lanes, ER, sequence, etc.).

## Files to update

### 1. `src/routes/__root.tsx` — sitewide defaults
- `title`: `"סוכן ניתוח מערכות — תרשימים מתוך טקסט"`
- `description`: `"סוכן AI לאנליסטים: הופך דרישות וטקסט חופשי לתרשימי זרימה, swim-lanes, ER ורצף — עם עריכה ויזואלית וקוד Mermaid."`
- Add sitewide `og:site_name`, `og:type: website`.

### 2. `src/routes/index.tsx` — landing
- `title`: `"סוכן ניתוח מערכות | תרשימים מתוך פרומפט"`
- `description`: `"תארו את התהליך במילים — קבלו תרשים מקצועי. עריכה ויזואלית + קוד Mermaid, שמירה בענן, ייצוא ל-SVG/JPG/Mermaid."`
- Matching `og:title` / `og:description` / `og:url="/"`.
- Update the visible landing copy (h1, subtitle, feature cards, footer, button labels) so it matches the new meta — otherwise SEO and UI tell different stories.

### 3. `src/routes/login.tsx`
- `title`: `"כניסה — סוכן ניתוח מערכות"`
- `description`: `"היכנסו כדי לשמור ולנהל את תרשימי הניתוח שלכם."`
- Update visible copy: header "Mermaid Studio" → "סוכן ניתוח מערכות", "Sign in to your diagrams." → "כניסה לתרשימי הניתוח שלך".

### 4. `src/routes/_authenticated/dashboard.tsx`
- `title`: `"התרשימים שלי — סוכן ניתוח מערכות"`
- `description`: `"כל תרשימי הניתוח שלך במקום אחד — צרו חדש מתוך פרומפט או מתבנית."`

### 5. `src/routes/_authenticated/editor.$id.tsx`
- `title`: `"עורך תרשים — סוכן ניתוח מערכות"`
- `description`: `"עריכת תרשים ניתוח מערכות עם תצוגה ויזואלית וקוד Mermaid זה לצד זה."`

### 6. Shared header label (`_authenticated.tsx`)
- "Mermaid Studio" → "סוכן ניתוח מערכות" כדי לשמור על עקביות עם המטא.

## Out of scope
- לא משנים את הלוגיקה, סכמת ה-DB, או שמות הקבצים/המסלולים.
- לא מוסיפים `og:image` (אין נכס ויזואלי מתאים כרגע — עדיף בלי מאשר תמונה גנרית).
- לא נוגעים ב-`canonical` (כבר לא מוגדר ב-root, וזה הנכון).

## Notes (technical)
- כל הכותרות נכנסות כ-entry בתוך `meta` (לא שדה `title` עליון — הוא מתעלם).
- `og:url` נשאר יחסי (`"/"`, `"/login"`, `"/dashboard"`) כי אין דומיין קבוע.
- שמירה על הפורמט הקיים של `head()` ב-TanStack — רק שינוי תוכן מחרוזות.
