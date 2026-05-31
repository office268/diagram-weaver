import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "מדיניות פרטיות — סוכן ניתוח מערכות" },
      { name: "description", content: "מדיניות הפרטיות של make-IT solutions." },
      { property: "og:title", content: "מדיניות פרטיות — סוכן ניתוח מערכות" },
      { property: "og:url", content: "/privacy" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← חזרה
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-foreground">מדיניות פרטיות</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          השירות מופעל על ידי <strong>make-IT solutions</strong> ("אנחנו"), המשמשים כ-Data
          Controller של המידע האישי שלכם. מדיניות זו מסבירה אילו נתונים אנו אוספים, למה, ולמי הם
          משותפים.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-foreground">איזה מידע אנו אוספים</h2>
        <ul className="list-disc pr-5 space-y-1">
          <li>
            <strong>פרטי חשבון:</strong> כתובת אימייל, שם תצוגה, תמונת פרופיל (אם סופקה דרך Google).
          </li>
          <li>
            <strong>תוכן שנוצר:</strong> מסמכי האפיון, הפרומפטים, הערות וההגדרות שלכם.
          </li>
          <li>
            <strong>טלמטריה ולוגים:</strong> כתובת IP, סוג דפדפן, שעות שימוש — לצורך אבטחה ושיפור.
          </li>
          <li>
            <strong>תשלומים:</strong> פרטי תשלום נאספים ומאוחסנים על ידי Paddle בלבד — אנחנו לא
            רואים פרטי כרטיס אשראי.
          </li>
        </ul>

        <h2 className="pt-2 text-lg font-semibold text-foreground">למה אנו משתמשים במידע</h2>
        <ul className="list-disc pr-5 space-y-1">
          <li>מתן השירות וניהול החשבון (ביצוע חוזה).</li>
          <li>אבטחה, מניעת הונאות, ועמידה בחובות חוקיות (אינטרסים לגיטימיים / חובה חוקית).</li>
          <li>תמיכת לקוחות ושיפור המוצר (אינטרסים לגיטימיים).</li>
        </ul>

        <h2 className="pt-2 text-lg font-semibold text-foreground">עם מי אנו משתפים מידע</h2>
        <ul className="list-disc pr-5 space-y-1">
          <li>
            <strong>Supabase</strong> — תשתית אחסון ובסיס נתונים.
          </li>
          <li>
            <strong>ספקי מודלי AI</strong> — לעיבוד הפרומפטים ויצירת התוכן.
          </li>
          <li>
            <strong>Paddle.com</strong> — ה-Merchant of Record שלנו. Paddle מטפל בתשלומים, ניהול
            מנויים, חשבוניות וציות לדיני מס.
          </li>
          <li>יועצים מקצועיים (משפטיים/הנהלת חשבונות) ורשויות במקרה של דרישה חוקית.</li>
        </ul>

        <h2 className="pt-2 text-lg font-semibold text-foreground">שמירת מידע</h2>
        <p>
          אנו שומרים את הנתונים שלכם כל עוד החשבון פעיל ולמשך תקופה סבירה לאחר מכן לצורך עמידה
          בחובות חוקיות. ניתן לבקש מחיקה בכל עת.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-foreground">הזכויות שלכם</h2>
        <p>
          עומדת לכם זכות לגישה, תיקון, מחיקה, הגבלת עיבוד, ניוד נתונים והתנגדות לעיבוד, בהתאם
          לחוקי הגנת הפרטיות החלים. ניתן לממש את הזכויות על ידי פנייה אלינו.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-foreground">אבטחה</h2>
        <p>
          אנו מיישמים אמצעי אבטחה טכניים וארגוניים נאותים — הצפנה בתעבורה, בקרת גישה, ומדיניות
          Row-Level Security במסד הנתונים — כך שכל משתמש רואה רק את הנתונים שלו.
        </p>

        <h2 className="pt-2 text-lg font-semibold text-foreground">Cookies</h2>
        <p>
          אנו משתמשים ב-cookies חיוניים לניהול הסשן בלבד. איננו משתמשים בכלי analytics או פרסום של
          צד שלישי.
        </p>
      </div>
    </div>
  );
}
