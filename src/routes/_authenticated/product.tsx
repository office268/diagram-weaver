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

type Align = "start" | "center" | "end";
type Word = {
  text: string;
  size: string;
  weight: string;
  font: string; // font family class
  color: string;
  rotate: number;
  align: Align;
  italic?: boolean;
  tracking?: string;
  uppercase?: boolean;
};

// Importance tiers:
// HERO: text-6xl/8xl/9xl — Roadmap, User Journey, MVP
// MAJOR: text-4xl/6xl/7xl — Persona, Discovery, Market Fit
// MID:   text-3xl/5xl/6xl — KPIs, Retention
// MINOR: text-xl/3xl/4xl  — Backlog, Churn
const words: Word[] = [
  // HERO — center, huge, black serif
  { text: "Roadmap", size: "text-6xl sm:text-8xl md:text-9xl", weight: "font-black", font: "font-serif", color: "text-foreground", rotate: -3, align: "center", tracking: "tracking-tighter" },

  // MAJOR — italic sans, strong color
  { text: "User Journey", size: "text-4xl sm:text-6xl md:text-7xl", weight: "font-extrabold", font: "font-sans", color: "text-primary", rotate: -10, align: "start", italic: true, tracking: "tracking-tight" },

  // MINOR — small, muted, uppercase mono for contrast
  { text: "Backlog", size: "text-xl sm:text-2xl md:text-3xl", weight: "font-medium", font: "font-mono", color: "text-muted-foreground", rotate: 14, align: "end", uppercase: true, tracking: "tracking-[0.25em]" },

  // MAJOR — serif italic
  { text: "Discovery", size: "text-4xl sm:text-6xl md:text-7xl", weight: "font-bold", font: "font-serif", color: "text-foreground/85", rotate: 5, align: "end", italic: true },

  // HERO — bold sans, accent
  { text: "MVP", size: "text-7xl sm:text-9xl", weight: "font-black", font: "font-sans", color: "text-primary", rotate: 8, align: "start", tracking: "tracking-tighter" },

  // MID — sans semibold
  { text: "KPIs", size: "text-3xl sm:text-5xl md:text-6xl", weight: "font-bold", font: "font-sans", color: "text-primary/70", rotate: -12, align: "center", uppercase: true, tracking: "tracking-widest" },

  // MAJOR — serif center, dramatic
  { text: "Market Fit", size: "text-5xl sm:text-7xl md:text-8xl", weight: "font-extrabold", font: "font-serif", color: "text-foreground", rotate: -5, align: "center", italic: true },

  // MAJOR — accent
  { text: "Persona", size: "text-4xl sm:text-6xl md:text-7xl", weight: "font-bold", font: "font-serif", color: "text-accent-foreground", rotate: 7, align: "start" },

  // MID — sans
  { text: "Retention", size: "text-3xl sm:text-5xl md:text-6xl", weight: "font-semibold", font: "font-sans", color: "text-accent-foreground", rotate: 10, align: "end" },

  // MINOR — light italic serif
  { text: "Churn", size: "text-xl sm:text-3xl md:text-4xl", weight: "font-light", font: "font-serif", color: "text-muted-foreground/70", rotate: -16, align: "start", italic: true },
];

const alignToFlex: Record<Align, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
};

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
      </div>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:gap-10 sm:py-14">
        {words.map((w, i) => (
          <div key={i} className={`flex ${alignToFlex[w.align]}`}>
            <span
              className={`inline-block whitespace-nowrap animate-fade-in leading-none ${w.size} ${w.weight} ${w.font} ${w.color} ${w.italic ? "italic" : ""} ${w.uppercase ? "uppercase" : ""} ${w.tracking ?? "tracking-tight"}`}
              style={{
                transform: `rotate(${w.rotate}deg)`,
                animationDelay: `${i * 90}ms`,
                animationFillMode: "both",
              }}
            >
              {w.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
