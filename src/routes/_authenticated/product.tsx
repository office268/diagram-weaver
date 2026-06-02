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
  size: string; // tailwind text-* + weight
  color: string; // tailwind color class
  rotate: number; // degrees
  align: Align;
  italic?: boolean;
};

// Each word lives in its own row → guaranteed no overlap.
// Variety comes from font size, weight, color, rotation, and horizontal alignment.
const words: Word[] = [
  { text: "Roadmap", size: "text-4xl sm:text-7xl md:text-8xl font-black", color: "text-foreground", rotate: -2, align: "center" },
  { text: "User Journey", size: "text-3xl sm:text-5xl md:text-6xl font-bold", color: "text-primary", rotate: -8, align: "start", italic: true },
  { text: "Discovery", size: "text-2xl sm:text-4xl md:text-5xl font-bold", color: "text-foreground/80", rotate: 6, align: "end", italic: true },
  { text: "Persona", size: "text-3xl sm:text-5xl md:text-6xl font-semibold", color: "text-accent-foreground", rotate: 4, align: "start" },
  { text: "MVP", size: "text-3xl sm:text-5xl md:text-6xl font-extrabold", color: "text-primary/90", rotate: 12, align: "end" },
  { text: "Market Fit", size: "text-2xl sm:text-4xl md:text-5xl font-bold", color: "text-foreground", rotate: -6, align: "center" },
  { text: "KPIs", size: "text-2xl sm:text-4xl md:text-5xl font-bold", color: "text-primary/80", rotate: -10, align: "start" },
  { text: "Retention", size: "text-2xl sm:text-4xl md:text-5xl font-semibold", color: "text-accent-foreground", rotate: 8, align: "end" },
  { text: "Backlog", size: "text-xl sm:text-3xl md:text-4xl font-semibold", color: "text-muted-foreground", rotate: -4, align: "start", italic: true },
  { text: "Churn", size: "text-xl sm:text-3xl md:text-4xl font-light", color: "text-muted-foreground", rotate: 10, align: "center", italic: true },
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


      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 sm:gap-6 sm:py-12">
        {words.map((w, i) => (
          <div key={i} className={`flex ${alignToFlex[w.align]}`}>
            <span
              className={`inline-block whitespace-nowrap font-serif tracking-tight animate-fade-in ${w.size} ${w.color} ${w.italic ? "italic" : ""}`}
              style={{
                transform: `rotate(${w.rotate}deg)`,
                animationDelay: `${i * 80}ms`,
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
