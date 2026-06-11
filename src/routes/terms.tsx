// ============================================================
// src/routes/terms.tsx
// Route — terms.tsx
// מסך/דף ב-TanStack Router (file-based routing)
// ============================================================
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "תנאי שימוש — סוכן ניתוח מערכות" },
      { name: "description", content: "תנאי השימוש בשירות של make-IT solutions." },
      { property: "og:title", content: "תנאי שימוש — סוכן ניתוח מערכות" },
      { property: "og:url", content: "/terms" },
    ],
    links: [{ rel: "canonical", href: "/terms" }],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← חזרה
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-foreground">תנאי שימוש</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          השירות "סוכן ניתוח מערכות" מסופק על ידי <strong>make-IT solutions</strong> ("אנחנו").
          השימוש בשירות מהווה הסכמה לתנאים אלו.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-foreground">1. השירות</h2>
        <p>
          השירות מאפשר יצירת מסמכי אפיון מערכות בעזרת מודלי AI. תוכן שנוצר על ידי המודל הוא עזר
          בלבד — אחריות סופית על נכונות ומלאות המסמך חלה עליכם, ויש לבדוק כל פלט לפני שימוש מקצועי.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-foreground">2. חשבון ושימוש מותר</h2>
        <p>
          עליכם לשמור על סודיות פרטי הכניסה לחשבונכם, ולספק מידע מדויק. אסור להשתמש בשירות לפעילות
          לא חוקית, להפצת תוכן פוגעני, להפרת זכויות יוצרים, להפעלת תוכנות זדוניות, לסקרייפינג או
          ניסיון לעקוף אבטחה.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-foreground">3. תשלומים ומנויים</h2>
        <p>
          תהליך הרכישה מבוצע על ידי <strong>Paddle.com</strong> שמשמש כ-Merchant of Record של כל
          ההזמנות שלנו. Paddle מטפל בכל הפניות הקשורות לתשלום, חיוב, מסים והחזרים. תנאי הרכישה
          המלאים זמינים ב-
          <a
            href="https://www.paddle.com/legal/checkout-buyer-terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            תנאי הקנייה של Paddle
          </a>.
        </p>
        <p>
          מנוי חודשי מתחדש אוטומטית בכל חודש עד לביטולו. ניתן לבטל בכל עת מדף החיוב — הגישה
          תישמר עד תום התקופה ששולמה. ראו את <Link to="/refund-policy" className="underline">מדיניות ההחזרים</Link> שלנו.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-foreground">4. קניין רוחני</h2>
        <p>
          אנחנו שומרים על כל הזכויות בשירות, בקוד, בעיצוב ובמותג. השימוש שלכם מקנה לכם רישיון
          מוגבל, אישי ולא ניתן להעברה להשתמש בשירות בהתאם למסלול הנבחר. תוכן שאתם יוצרים נשאר
          בבעלותכם.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-foreground">5. זמינות וערבויות</h2>
        <p>
          השירות ניתן "כמו שהוא" ("AS-IS"). איננו מתחייבים על זמינות רציפה או חופשית מתקלות.
          אחריותנו הכוללת מוגבלת לסכומים ששילמתם בפועל ב-12 החודשים האחרונים.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-foreground">6. השעיה וסיום</h2>
        <p>
          אנו רשאים להשעות או לסיים את הגישה לחשבון במקרה של הפרה מהותית של תנאים אלו, אי-תשלום,
          חשד לפעילות הונאה או סיכוני אבטחה, או הפרות חוזרות ונשנות של מדיניות השימוש.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-foreground">7. שינויים</h2>
        <p>
          אנו רשאים לעדכן את התנאים מעת לעת. שימוש מתמשך בשירות לאחר עדכון מהווה הסכמה לגרסה
          המעודכנת.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-foreground">8. יצירת קשר</h2>
        <p>שאלות? פנו אלינו דרך טופס צור קשר באתר.</p>
      </div>
    </div>
  );
}
