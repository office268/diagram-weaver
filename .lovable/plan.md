## הבעיה
בדף תצוגת תרשים (`/diagram/$id`) ובצ'אט, התרשים מוצג קטן ואין דרך להגדיל/להזיז אותו לבחינה מפורטת.

## הפתרון
להוסיף יכולת zoom & pan ל-`MermaidPreview` באמצעות הספרייה `react-zoom-pan-pinch` (קלה, תומכת ב-pinch במובייל וגלגלת בדסקטופ).

### שינויים
1. **התקנה**: `bun add react-zoom-pan-pinch`.
2. **`src/components/mermaid-preview.tsx`**:
   - לעטוף את ה-SVG ב-`TransformWrapper` / `TransformComponent`.
   - להוסיף שורת כלים צפה (פינה עליונה) עם כפתורים: הגדל (+), הקטן (−), איפוס, ומסך מלא.
   - תמיכה ב-pinch-to-zoom במגע ובגלגלת בעכבר.
   - `minScale=0.5`, `maxScale=4`, `initialScale=1`, `centerOnInit`.
3. **מצב מסך מלא**:
   - כפתור שפותח דיאלוג (`Dialog` קיים מ-shadcn) במסך כמעט מלא עם אותו `MermaidPreview` בפנים — חוויית בחינה נוחה במובייל.

### הערות
- אין שינויי backend / DB.
- שינוי מקומי בקומפוננטה אחת — מתפשט אוטומטית לכל מקום שמשתמש ב-`MermaidPreview` (דף תרשים, צ'אט, עורך).
