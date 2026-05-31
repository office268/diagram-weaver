## תוכנית הטמעת תשלומים

### מודל עסקי
- **מנוי חודשי**: $20/חודש → מעניק 125 קרדיטים כל חודש
- **חבילת קרדיטים חד-פעמית**: 100 קרדיטים ב-$20 (לא מתחדש)
- **צריכה**: יצירת כל מסמך אפיון = 1 קרדיט

### שלבי הביצוע

**1. מסד נתונים** (migration)
- `subscriptions` — מעקב מנויים (לפי סכמת Paddle הסטנדרטית)
- `credits` — יתרת קרדיטים לכל משתמש (`user_id`, `balance`)
- `credit_transactions` — היסטוריה (סוג: `subscription_grant` / `purchase` / `consumption`, סכום, מסמך מקושר)
- RLS: משתמש רואה רק את שלו; כתיבה רק ל-service role
- פונקציית `consume_credit(user_id, doc_id)` אטומית

**2. מוצרים ב-Paddle** (test env)
- `monthly_subscription` — $20/חודש
- `credits_100` — $20 חד-פעמי

**3. Webhook** (`/api/public/payments/webhook`)
- `subscription.created/updated` → עדכון טבלת subscriptions + הענקת 125 קרדיטים בחידוש
- `transaction.completed` של חבילת קרדיטים → הוספת 100 קרדיטים

**4. דפי UI**
- `/pricing` — שני מסלולים עם כפתורי checkout
- `/billing` (תחת `_authenticated`) — סטטוס מנוי, יתרת קרדיטים, היסטוריה, ניהול מנוי (Paddle portal)
- באנר test mode
- הצגת יתרת קרדיטים בתפריט המשתמש

**5. שילוב באפליקציה**
- לפני יצירת מסמך (ב-`generate-spec.ts`): בדיקת יתרה; אם 0 → 402 עם הודעה ידידותית + לינק ל-pricing
- אחרי הצלחה: ניכוי 1 קרדיט (transaction)

**6. עמודי מדיניות** (דרישת Paddle)
- עדכון `/terms`, `/privacy`, ויצירת `/refund-policy`

### שאלה אחת לפני יציאה לדרך
**שם עסקי רשום** — Paddle דורש שזה יופיע ב-Terms וב-Privacy. האם להשתמש ב-"Make-IT" / "make-i-tec" או שם רשום אחר?
