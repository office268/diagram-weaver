import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/product")({
  head: () => ({
    meta: [
      { title: "ניהול מוצר — Analyst Assist" },
      { name: "description", content: "כלים למנהלי מוצר — בקרוב." },
    ],
  }),
  component: ProductPage,
});

type Word = {
  text: string;
  className: string;
  style: React.CSSProperties;
  delay: number;
};

// Importance drives font size; positions and rotations are scattered.
const words: Word[] = [
  {
    text: "Roadmap",
    className:
      "font-serif font-black tracking-tight text-foreground text-6xl sm:text-8xl md:text-9xl",
    style: { top: "38%", left: "50%", transform: "translate(-50%, -50%) rotate(-2deg)" },
    delay: 0,
  },
  {
    text: "User Journey",
    className:
      "font-serif font-bold italic tracking-tight text-primary text-4xl sm:text-6xl md:text-7xl",
    style: { top: "12%", left: "8%", transform: "rotate(-12deg)" },
    delay: 80,
  },
  {
    text: "Persona",
    className:
      "font-serif font-semibold tracking-tight text-foreground/80 text-4xl sm:text-5xl md:text-6xl",
    style: { top: "20%", right: "6%", transform: "rotate(9deg)" },
    delay: 160,
  },
  {
    text: "KPIs",
    className:
      "font-serif font-bold tracking-tight text-primary/80 text-3xl sm:text-5xl md:text-6xl",
    style: {
      top: "50%",
      left: "4%",
      transform: "rotate(-90deg)",
      transformOrigin: "left center",
    },
    delay: 240,
  },
  {
    text: "Backlog",
    className:
      "font-serif font-semibold italic tracking-tight text-muted-foreground text-3xl sm:text-4xl md:text-5xl",
    style: {
      top: "50%",
      right: "6%",
      transform: "rotate(90deg)",
      transformOrigin: "right center",
    },
    delay: 320,
  },
  {
    text: "MVP",
    className:
      "font-serif font-extrabold tracking-tight text-accent-foreground text-4xl sm:text-6xl md:text-7xl",
    style: { bottom: "14%", left: "18%", transform: "rotate(18deg)" },
    delay: 400,
  },
  {
    text: "Persona",
    className:
      "font-serif font-light italic tracking-tight text-foreground/30 text-2xl sm:text-3xl md:text-4xl",
    style: { bottom: "20%", right: "20%", transform: "rotate(-8deg)" },
    delay: 480,
  },
];

function ProductPage() {
  return (
    <div
      className="relative min-h-[calc(100vh-8rem)] overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top, hsl(var(--muted)) 0%, hsl(var(--background)) 70%)",
      }}
      dir="rtl"
    >
      <div className="relative z-10 px-6 pt-8 text-center [direction:rtl]">
        <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-muted-foreground">
          ניהול מוצר
        </p>
        <h1 className="mt-2 text-lg sm:text-2xl font-semibold text-foreground">
          כלים ייעודיים למנהלי מוצר — בקרוב
        </h1>
      </div>

      <div className="relative mx-auto h-[70vh] w-full max-w-6xl">
        {words.map((w, i) => (
          <span
            key={i}
            className={`absolute select-none whitespace-nowrap animate-fade-in ${w.className}`}
            style={{
              ...w.style,
              animationDelay: `${w.delay}ms`,
              animationFillMode: "both",
            }}
          >
            {w.text}
          </span>
        ))}
      </div>
    </div>
  );
}
