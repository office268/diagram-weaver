## הבעיה
ב-Use Case actor שמייצג מערכת חיצונית (כמו "מערכת תשלום") מוצג כדמות מקל, בדיוק כמו משתמש אנושי. בפועל הסכמה כבר תומכת ב-`stereotype: "external"` על actor (ראה דוגמה בקובץ הפרומפט), והרכיב `ActorNode` פשוט מתעלם מזה.

## הפתרון

### 1. `src/components/diagram-nodes.tsx` — `ActorNode`
לבדוק `data.stereotype` (וגם רמז ב-`data.label` כמו "מערכת"/"שירות"/"API") כדי להחליט בין שתי וריאציות רינדור:

- **אנושי (ברירת מחדל)**: דמות המקל הקיימת.
- **מערכת חיצונית** (`stereotype` שווה `"external"` / `"system"` / מתחיל ב"מערכת"): אייקון מסך מחשב + בסיס, ומתחתיו `«external system»` כסטריאוטיפ + הלייבל.

הרוחב/גובה של ה-node נשמר זהה (`60×90` כמו ב-`NODE_SIZE.actor`) כדי שלא לשבור את ה-layout שכבר דוחף actors החוצה מה-boundary.

### 2. `src/agents/diagrams/rf-json.server.ts` — `diagram_usecase.contentRules`
תוספת **לא-מורידת-איכות** של כלל אחד (לא מסיר/מחליש כללים קיימים, רק מוסיף הנחיה לסטריאוטיפ):

> "אם actor הוא מערכת/שירות חיצוני (לא בן-אדם) — סמן אותו עם `stereotype: \"external\"`. דוגמה: מערכת תשלום, שירות SMS, מערכת CRM חיצונית."

ולקריטריון self-critique נוסיף שאלה אחת:
> "האם כל actor שאינו אנושי סומן עם `stereotype: \"external\"`?"

(הדוגמה הקיימת בשורה 58 כבר משתמשת ב-`stereotype: "external"` ל-"מערכת תשלום", אז זה רק מחזק עקביות.)

## מה לא משתנה
- אין שינוי בסכמת הצמתים/edges (`stereotype` כבר אופציונלי על כל node).
- אין שינוי ב-layout (`src/lib/diagram-rf.ts`) — actor "מערכת" עדיין נחשב actor לכל דבר ויוצב מחוץ ל-boundary.
- אין שינוי בקומפוננטות אחרות, ב-validation, ב-thinking steps או ב-pipeline.
- אין הסרה/החלשה של פרומפטים, מינימומים, או self-critique קיימים — רק תוספת.

## קבצים שישתנו
- `src/components/diagram-nodes.tsx` — `ActorNode` הופך לשתי וריאציות רינדור.
- `src/agents/diagrams/rf-json.server.ts` — שורה אחת נוספת ב-`contentRules` של `diagram_usecase` ושאלה אחת נוספת ב-`critique`.

## פרטים טכניים
- בדיקת "מערכת חיצונית": `stereotype?.toLowerCase()` ∈ {`external`,`system`} **או** `label` מתחיל ב-"מערכת " (fallback לתאימות לאחור עם פלטים ישנים שלא סימנו stereotype).
- אייקון: SVG inline פשוט — מלבן מסך + בסיס/חצובה, עובי קו `1.6`, צבע `var(--foreground)` (תואם לסגנון של שאר ה-nodes).
- מתחת לאייקון: שורה קטנה `«external»` ב-`text-muted-foreground` ואז ה-label.
