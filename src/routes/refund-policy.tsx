import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "מדיניות החזרים — סוכן ניתוח מערכות" },
      { name: "description", content: "מדיניות החזרים של make-IT solutions: 30 יום החזר כספי מלא." },
      { property: "og:title", content: "מדיניות החזרים — סוכן ניתוח מערכות" },
      { property: "og:url", content: "/refund-policy" },
    ],
    links: [{ rel: "canonical", href: "/refund-policy" }],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← חזרה
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-foreground">מדיניות החזרים</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          <strong>אחריות 30 יום להחזר כספי.</strong> אם אינכם מרוצים מהשירות, ניתן לבקש החזר כספי
          מלא בתוך 30 יום מתאריך הרכישה.
        </p>
        <p>
          <strong>איך לבקש החזר:</strong> ההחזרים מטופלים על ידי ספק התשלומים שלנו, Paddle. ניתן
          להיכנס ל-
          <a
            href="https://paddle.net"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            paddle.net
          </a>{" "}
          ולבקש החזר, או לפנות אלינו במייל ואנחנו נטפל בכך מולם.
        </p>
        <p>
          <strong>מנויים חודשיים:</strong> ניתן לבטל את המנוי בכל עת מדף החיוב. ביטול בתוך 30 יום
          מהחיוב הראשון מזכה בהחזר מלא. חיובי חידוש חודשיים ניתנים להחזר באותו חלון של 30 יום
          לחיוב הספציפי.
        </p>
        <p>
          <strong>חבילות קרדיטים חד-פעמיות:</strong> ניתן להחזר מלא בתוך 30 יום מהרכישה, בתנאי
          שלא נוצלו יותר מ-10% מהקרדיטים.
        </p>
        <p className="text-xs">
          השירות ניתן על ידי make-IT solutions. כל הרכישות מבוצעות דרך Paddle.com שמשמש כ-Merchant
          of Record.
        </p>
      </div>
    </div>
  );
}
