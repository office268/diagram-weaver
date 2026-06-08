## הבעיה
ב-`src/lib/diagram-rf.ts` (פונקציית `buildDiagramRF`) dagre מסדר actors ו-useCases יחד בלי מודעות ל-systemBoundary. ה-boundary מצויר אחר כך סביב ה-useCases, ולכן actors עלולים ליפול בתוכו.

## הפתרון (layout בלבד — בלי שינוי פרומפטים/סכמות/ולידציה)
לאחר ש-dagre מסיים, ולפני חישוב ה-systemBoundary, בדיאגרמת `diagram_usecase`:

1. לחשב את גבולות אשכול ה-useCases (minX/maxX/minY/maxY).
2. לחלק את ה-actors לשתי קבוצות לפי כיוון הקשר ל-useCases:
   - **Primary** (מקור של edge ל-useCase) → שמאל לגבול.
   - **Secondary** (יעד בלבד) → ימין לגבול.
   - actor ללא קשרים → ברירת מחדל שמאל.
3. לקבוע מחדש את מיקום ה-actors:
   - X: `boundary.minX - gap - actorW` לשמאליים, `boundary.maxX + gap` לימניים (gap ≈ 80px, כך שהם נשארים מחוץ ל-padding של ה-boundary שהוא 40px).
   - Y: לפזר אנכית בתוך טווח גובה ה-boundary, לפי הסדר היחסי שדגרה כבר נתן (שמירה על ה-ordering מצמצמת חציית edges).
4. לאחר מכן לחשב את ה-systemBoundary כמו היום — מבוסס על useCases בלבד, כך שגם אחרי הזזת ה-actors הוא נשאר חסום לאזור ה-useCases וה-actors תמיד מחוצה לו.
5. (אופציונלי קטן) להרחיב את `nodesep`/`ranksep` של ה-usecase במעט אם נראה צפוף, אך לא חובה.

## מה לא משתנה
- אין שינוי ב-`rf-json.server.ts` (פרומפט, system prompt, סכמות, ולידציה, self-critique, thinking steps).
- אין שינוי בקומפוננטות הרינדור של React-Flow.
- אין שינוי בלוגיקה של דיאגרמות אחרות (flow/activity/sequence/state/erd/deployment).

## קבצים שישתנו
- `src/lib/diagram-rf.ts` — בלוק חדש בתוך `buildDiagramRF` שרץ רק כאשר `out.kind === "diagram_usecase"`, ממוקם בין סיום ה-`positioned.map(...)` (שורה 287) לבין בניית ה-`sysBoundary` (שורה 325).

## פרטים טכניים
- שימוש ב-`NODE_SIZE.actor` (60×90) לחישוב הזחה.
- אם יש >1 actor בצד, פיזור: `y_i = boundary.minY + (i+1) * H / (n+1) - actorH/2`.
- חישוב כיוון לפי `out.edges`: אם קיים edge עם `source === actor.id` ו-`target` הוא useCase → primary; אחרת אם רק `target === actor.id` → secondary.
