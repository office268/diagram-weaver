הוספת אייקון הגדרות (Settings) בשורה הראשונה של ה-header ב-AuthenticatedLayout, ליד אייקון החיפוש הקיים.

שינויים:
- `src/routes/_authenticated.tsx` — הוספת אייקון Settings מ-lucide-react ל-import, והוספת כפתור/קישור עם `ms-auto` (או מימין לכפתור החיפוש) שמוביל לנתיב `/settings`.

לחיצה על האייקון תעביר את המשתמש ישירות לדף ההגדרות.