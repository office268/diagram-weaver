## מטרה
להוסיף בדף ההגדרות (`/_authenticated/settings`) קולפס חדש "לוג התחברויות" — גלוי **אך ורק לאדמין** — שמציג את כל אירועי ההתחברות לאתר.

## מקור הנתונים — שילוב של שניים
1. **טבלה חדשה `login_events`** — תיעוד מדויק מצד האפליקציה (זמן, user_id, אימייל, provider, user agent, IP). תיכתב אוטומטית בכל `SIGNED_IN` דרך listener קיים ב-`__root.tsx`.
2. **Auth Logs של Lovable Cloud** — שליפת ניסיונות התחברות (כולל כושלים) דרך `supabase--analytics_query` ב-server function אדמין.

הקולפס יציג טבלה משולבת ממוינת לפי זמן יורד.

## שינויים

### 1. מיגרציית DB
טבלה `public.login_events`:
- `id uuid PK`, `user_id uuid`, `email text`, `provider text` (google/email/...), `user_agent text`, `ip text` (nullable), `event text` (signed_in/signed_out), `created_at timestamptz default now()`
- GRANTs: `authenticated` insert בלבד על עצמו; `service_role` הכל; אין anon
- RLS:
  - `INSERT`: `auth.uid() = user_id`
  - `SELECT`: רק אדמין (`has_role(auth.uid(), 'admin')`)
- אינדקס על `created_at desc` ועל `user_id`

### 2. רישום אירוע התחברות
ב-`src/routes/__root.tsx` בתוך ה-`AuthBridge`, כשמתקבל `SIGNED_IN`/`SIGNED_OUT` — לקרוא ל-server function חדשה `recordLoginEvent` שמכניסה שורה ל-`login_events` עם פרטי המשתמש וה-user agent. שקטה בשגיאות (לא חוסמת UX).

### 3. Server functions חדשות (`src/lib/login-log.functions.ts`)
- `recordLoginEvent` (`requireSupabaseAuth`) — INSERT ל-`login_events`.
- `getLoginLog` (אדמין בלבד; בודק `has_role` דרך `supabaseAdmin` ומחזיר 403 אחרת) — מחזיר:
  - 100 שורות אחרונות מ-`login_events`
  - 100 רשומות auth_logs אחרונות מה-analytics (msg כמו "login", "logout", "token refreshed", שגיאות) דרך `supabaseAdmin` REST ל-analytics endpoint — או נשתמש בשאילתת SQL רגילה אם זמין; אם אין גישה, נדלג בשקט ונחזיר רק `login_events`.
  - איחוד ומיון יורד לפי timestamp.

### 4. רכיב UI חדש `src/components/login-log-card.tsx`
- שימוש ב-`useQuery` שקורא ל-`getLoginLog`.
- טבלה responsive: זמן (פורמט מקומי), אימייל, provider, סוג אירוע (badge: הצלחה/כישלון/יציאה), מקור (app/auth-log), IP/UA מקוצר.
- כפתור רענון, מצבי loading/empty.

### 5. שילוב בדף ההגדרות
ב-`src/routes/_authenticated/settings.tsx`, בתוך הבלוק `{isAdmin ? (...)}`, להוסיף `SettingsSection` חדש:
```tsx
<SettingsSection title="לוג התחברויות" description="כל ניסיונות ההתחברות לאתר.">
  <LoginLogCard />
</SettingsSection>
```

## הערות טכניות
- ה-IP אינו זמין ב-`onAuthStateChange` של הדפדפן — נשאיר ריק ברישום מהקליינט; ה-IP יבוא מ-auth_logs.
- אם שאילתת analytics נכשלת/אינה זמינה ב-runtime — fallback להצגת `login_events` בלבד עם הודעה דיסקרטית.
- כל הקריאות עוברות דרך `createServerFn`, ללא חשיפת service role לקליינט.
