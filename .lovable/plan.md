## הצעה: הוספת אריח "תרשים ERD"

כרגע יש 10 אריחים בלוח (5 מסמכים + 5 תרשימים) בגריד של 3 עמודות — מה שמשאיר שורה אחרונה עם אריח בודד ופוגע בסימטריה הוויזואלית. הוספת אריח נוסף תיצור 11 אריחים (3+3+3+2), סידור הרבה יותר מאוזן מבחינה ויזואלית מ-3+3+3+1.

### הקובייה המוצעת: תרשים ERD (Entity-Relationship Diagram)

זה באמת חסר בקטלוג — יש לנו `diagram_state`, `diagram_flow`, `diagram_sequence`, `diagram_usecase`, `diagram_deployment`, אבל אין תרשים יחסי-ישויות, שהוא אחד התרשימים הכי בסיסיים בניתוח מערכות (מודל נתונים ויזואלי, טבלאות וקשרים).

- **label:** "תרשים ERD"
- **description:** "ישויות, שדות והקשרים ביניהן במודל הנתונים."
- **icon:** `Database` מ-lucide-react (מתאים סמנטית, שונה ויזואלית מהאייקונים הקיימים)
- **colorClass:** `text-rose-500` (צבע שעוד לא בשימוש בלוח, מוסיף גיוון)
- **mermaidHint:** `erDiagram`
- **category:** `diagram`

### שינויים בקוד

קובץ יחיד: `src/lib/output-types.ts`

1. הוספת `"diagram_erd"` לטיפוס `DiagramOutputKey`.
2. הוספת `import { Database }` מ-`lucide-react`.
3. הוספת ערך חדש ל-`OUTPUT_TYPES` עם השדות שלמעלה.
4. שיבוץ ב-`OUTPUT_TYPE_ORDER` מיד אחרי `diagram_sequence` ולפני `spec_detailed` — כך ה-ERD יושב לוגית ליד שאר תרשימי הנתונים/הזרימה, ולפני המסמכים המפורטים שמשתמשים במודל הנתונים.

הסדר החדש יהיה:
```
initiation, business_requirements, diagram_usecase,
technical_requirements, spec_overview, diagram_flow,
diagram_sequence, diagram_erd, spec_detailed,
diagram_state, diagram_deployment
```

לא נדרש שינוי ב-`dashboard.tsx` — הוא ממפה אוטומטית את `OUTPUT_TYPE_ORDER`. גם תשתית היצירה (`createChatThread`, ה-agents) כבר תומכת בכל מפתח שמוגדר כאן, כך שאין צורך בשינויים נוספים בצד השרת.

אישור ואני מיישם.