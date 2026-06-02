## אבחון

הוספתי בדיקת admin בצד הלקוח, וה-network מראה שהקריאה ל-`getIsAdmin` באמת חוזרת עם status 200 וטוקן Bearer תקין. ב-DB אישרתי ש-`office@make-i-tec.com` (`1c05c2d4-...248a4`) הוא `admin`. עם זאת — ב-session replay הדיאלוג נפתח לחמש שניות ולא נראה כפתור AI.

יש שתי השערות סבירות:
1. **תזמון רינדור** — `useQuery` עדיין `pending` כשהדיאלוג נפתח לראשונה, ו-`ctxIsAdmin` הוא `false` (ה-root loader רץ ב-SSR ללא טוקן). הכפתור נסתר עד שהשאילתה חוזרת.
2. **המיקום בתוך גוף הדיאלוג גורם שהמשתמש פשוט פספס אותו** (קטן, ליד תווית "תיאור").

## תיקון

### 1. לפתור את ה-SSR — `isAdmin` נכון כבר בטעינה הראשונה
ב-`src/routes/__root.tsx`, ה-loader קורא ל-`getIsAdmin()` ישירות. הקריאה הזו רצה ב-SSR ללא Authorization header, נכשלת, ומחזירה `isAdmin: false` שנשמר ב-`useSiteTexts()` עד invalidation.

תיקון: להעביר את `getIsAdmin` ל-`Route.useRouteContext()`/loader רק בצד הלקוח, או פשוט להסיר את `getIsAdmin` מה-loader ולהסתמך אך ורק על ה-`useQuery` הקיים ב-`projects.index.tsx`. כך אין ערך SSR שמרעיל את ה-state.

### 2. להבטיח שהכפתור מתרנדר ברגע ש-query חוזר
ל-`useQuery` הקיים נוסיף `placeholderData`/בדיקת loading, ונחליף את התנאי כך שיציג skeleton קטן בזמן `isLoading`:

```tsx
{(isAdminLoading || isAdmin) && (
  <Button disabled={isAdminLoading || ideaMut.isPending} ...>
    ...
  </Button>
)}
```

(אם בסוף `isAdmin=false`, הכפתור ייעלם אחרי הטעינה — לא נורא למשתמש לא-מנהל.)

### 3. להעביר את כפתור ה-AI ל-DialogHeader
מיקום נוכחי: שורה קטנה ליד תווית "תיאור". המיקום החדש: שורת actions קטנה תחת `DialogTitle`/`DialogDescription`, כדי שהכפתור יהיה הדבר הראשון שרואים בדיאלוג.

```tsx
<DialogHeader>
  <DialogTitle>פרויקט חדש</DialogTitle>
  <DialogDescription>...</DialogDescription>
  {isAdmin && (
    <Button variant="outline" size="sm" className="mt-2 w-fit" onClick={() => ideaMut.mutate()}>
      <Sparkles className="ml-1.5 h-4 w-4" /> רעיון מה-AI
    </Button>
  )}
</DialogHeader>
```

### 4. לוג דיבוג זמני
להוסיף `useEffect(() => { console.log("[isAdmin]", { adminCheck, ctxIsAdmin, isAdmin, isAdminLoading }); }, [...])` כדי שאם הכפתור עדיין לא מופיע — נראה בקונסול בדיוק מה קורה.

## קבצים

- `src/routes/__root.tsx` — להסיר את הקריאה ל-`getIsAdmin()` מה-loader, ולהעביר ל-`isAdmin: false` קבוע (יחושב בקליינט בלבד).
- `src/routes/_authenticated/projects.index.tsx` — להעביר את הכפתור ל-`DialogHeader`, להוסיף state של `isLoading`, להוסיף לוג זמני.

## הערה למשתמש

לאחר הפריסה — **רענון קשה (Ctrl+Shift+R / משיכה מלמעלה במובייל)**, להיכנס שוב ל-/projects ולפתוח "פרויקט חדש". אם הכפתור עדיין לא מופיע — לפתוח את הקונסול בדפדפן ולהדביק לי את השורה `[isAdmin]`.