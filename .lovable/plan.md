## שינוי עיצוב האריחים בדף הבית

**קובץ יחיד**: `src/routes/_authenticated/dashboard.tsx`

### שינויים

1. **רשת 2 בשורה במובייל**
   - להחליף `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` ב-`grid-cols-2 lg:grid-cols-3`
   - הגדלת מרווח: `gap-4 sm:gap-5`

2. **פורמט קוביה (aspect ratio ריבועי)**
   - להוסיף `aspect-square` לכל אריח
   - תוכן מרוכז אנכית: אייקון גדול למעלה במרכז, שם מתחת, תיאור קטן מתחת (או להסתיר תיאור במובייל כדי לשמור על מראה קוביה נקי)
   - הסרת תג "מסמך/תרשים" מהמרכז — להעביר כפס צבעוני קטן בפינה העליונה
   - אייקון מוגדל ל-`h-7 w-7` בתוך ריבוע `h-14 w-14`

3. **אפקט תלת-מימד צף (2-3 שכבות)**
   - להוסיף ב-`src/styles.css` שתי utilities חדשות:
     - `.cube-3d` — צללים מרובדים שיוצרים תחושה של 2-3 שכבות מתחת לקוביה:
       ```
       box-shadow:
         0 1px 0 hsl(var(--border)),
         0 4px 0 -1px color-mix(in oklab, var(--card) 95%, var(--foreground)),
         0 5px 0 -1px hsl(var(--border)),
         0 8px 0 -2px color-mix(in oklab, var(--card) 90%, var(--foreground)),
         0 9px 0 -2px hsl(var(--border)),
         0 20px 30px -10px color-mix(in oklab, var(--foreground) 25%, transparent);
       transform: translateY(0);
       transition: transform 200ms ease, box-shadow 200ms ease;
       ```
     - `.cube-3d:hover` — `translateY(-4px)` עם צללים עמוקים יותר ליצירת תחושת "ריחוף" נוסף
     - `.cube-3d:active` — `translateY(2px)` עם פחות שכבות (לחיצה = הקוביה נדחפת פנימה)
   - להחליף את `hover-lift` הקיים ב-`cube-3d` באריחים

4. **גרדיאנט עדין על הקוביה**
   - רקע: `bg-gradient-to-br from-card to-accent/30` להוספת עומק אופטי
   - border עדין יותר: `border-border/60`

### לא משתנה
- הלוגיקה (mutation, ניווט, סוגים) נשארת זהה
- שאר הדפים לא נוגעים בהם
