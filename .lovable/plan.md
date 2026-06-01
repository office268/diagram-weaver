## תוכנית

1. **בקשת סוד** `LOVABLE_CLOUD_PAT` דרך `add_secret`.
2. **`src/lib/login-log.functions.ts`** — להחליף את הבלוק שמדלג בשקט בקריאה אמיתית ל-Management API:
   - `GET https://api.supabase.com/v1/projects/{ref}/analytics/endpoints/logs.all?sql=...`
   - שאילתה על `auth_logs` (Login/Logout/Signup + שגיאות), 200 שורות
   - מיפוי ל-`LoginLogRow` עם `source: "auth"`, status לפי error/status code, IP מ-`remote_addr`
   - fallback שקט ל-`login_events` בלבד אם נכשל
3. **`src/components/login-log-card.tsx`** — עמודת "מקור" (אפליקציה / Auth) + הערה דיסקרטית כשהיסטוריה לא זמינה.
