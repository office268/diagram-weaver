## מטרה
להציג בלוג ההתחברויות גם את ההיסטוריה שלפני הוספת הפיצ'ר — דרך auth_logs של Lovable Cloud.

## איך זה יעבוד
auth_logs לא נגישים ל-runtime של ה-Worker דרך client רגיל. הגישה היחידה היא דרך **Supabase Management API** (`https://api.supabase.com/v1/projects/{ref}/analytics/endpoints/logs.all`), שמקבל שאילתת SQL ומחזיר תוצאות. זה דורש Personal Access Token (PAT).

## שינויים

### 1. הוספת סוד `SUPABASE_ACCESS_TOKEN`
דרך `add_secret`. המשתמש יצטרך:
1. להיכנס ל-https://supabase.com/dashboard/account/tokens
2. ליצור PAT חדש (שם חופשי, למשל "lovable-auth-logs")
3. להדביק את הערך

### 2. עדכון `src/lib/login-log.functions.ts`
ב-`getLoginLog`, להחליף את הבלוק שמדלג בשקט בקריאה אמיתית:

```ts
const pat = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = process.env.SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];

if (pat && projectRef) {
  const sql = `
    select id, timestamp, event_message,
           metadata.msg as msg, metadata.status as status,
           metadata.path as path, metadata.error as error,
           metadata.remote_addr as ip
    from auth_logs
    cross join unnest(metadata) as metadata
    where metadata.msg in ('Login', 'Logout', 'Signup', 'User Recovery Requested')
       or metadata.status in ('400','401','403','422','500')
    order by timestamp desc
    limit 200
  `;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/analytics/endpoints/logs.all`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${pat}` },
      // sql מועבר כ-query param
    }
  );
  // ... מיפוי ל-LoginLogRow עם source: "auth"
}
```

נמפה כל שורה ל-`LoginLogRow`:
- `status: "error"` אם יש `metadata.error` או status ≥ 400
- `event: "signed_in"` / `"signed_out"` לפי `msg`
- `email` — לא תמיד זמין ב-auth_logs; נמלא ממה שיש (לרוב רק ב-user_id metadata)

אם הקריאה נכשלת (401/403/network) — fallback שקט ל-`login_events` בלבד, בלי לזרוק שגיאה.

### 3. UI — `src/components/login-log-card.tsx`
- להוסיף עמודה "מקור" (אפליקציה / Auth) או badge קטן
- אם `authLogsAvailable === false`, להציג הערה דיסקרטית: "היסטוריה מלאה דורשת חיבור ל-Lovable Cloud API"
- דה-דופ בסיסי: אם יש רשומה מ-`login_events` ורשומה מ-auth_logs באותה דקה לאותו user_id — להעדיף את `login_events` (יש email מלא)

## הערות טכניות
- ה-PAT שמור רק כסוד server-side, לא נחשף לקליינט.
- Management API מוגבל ב-rate; שמרני — 200 שורות, רק כשפותחים את הקולפס (כבר עכשיו `useQuery` בלי refetch אוטומטי).
- אם המשתמש לא יוסיף PAT — הכל ממשיך לעבוד עם `login_events` בלבד.

## תוצאה
לאחר אישור, אבקש את `SUPABASE_ACCESS_TOKEN` דרך `add_secret`, ואחרי שהוא נשמר אעדכן את הקוד.
