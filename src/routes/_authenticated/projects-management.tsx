// ============================================================
// src/routes/_authenticated/projects-management.tsx
// מסך מאומת (Authenticated route) — projects-management.tsx
// דורש משתמש מחובר; יושב תחת layout _authenticated
// ============================================================
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects-management")({
  head: () => ({
    meta: [
      { title: "ניהול פרויקטים — Analyst Assist" },
      { name: "description", content: "כלים לניהול פרויקטים — בקרוב." },
    ],
  }),
  component: ProjectsManagementPage,
});

type Align = "start" | "center" | "end";
type Word = {
  text: string;
  size: string;
  weight: string;
  font: string;
  color: string;
  rotate: number;
  align: Align;
  italic?: boolean;
  tracking?: string;
  uppercase?: boolean;
};

// HERO: Gantt, Timeline, Milestone
// MAJOR: Scope, Risk Management
// MID:   Velocity, Resource Allocation
// MINOR: Bottleneck, Dependency
const words: Word[] = [
  { text: "Gantt", size: "text-7xl sm:text-9xl", weight: "font-black", font: "font-serif", color: "text-foreground", rotate: -3, align: "center", tracking: "tracking-tighter" },

  { text: "Timeline", size: "text-4xl sm:text-6xl md:text-7xl", weight: "font-extrabold", font: "font-sans", color: "text-primary", rotate: -10, align: "start", italic: true, tracking: "tracking-tight" },

  { text: "Dependency", size: "text-xl sm:text-2xl md:text-3xl", weight: "font-medium", font: "font-mono", color: "text-muted-foreground", rotate: 14, align: "end", uppercase: true, tracking: "tracking-[0.25em]" },

  { text: "Milestone", size: "text-5xl sm:text-7xl md:text-8xl", weight: "font-bold", font: "font-serif", color: "text-foreground/85", rotate: 6, align: "end", italic: true },

  { text: "Scope", size: "text-6xl sm:text-8xl md:text-9xl", weight: "font-black", font: "font-sans", color: "text-primary", rotate: 8, align: "start", tracking: "tracking-tighter" },

  { text: "Velocity", size: "text-3xl sm:text-5xl md:text-6xl", weight: "font-bold", font: "font-sans", color: "text-primary/70", rotate: -12, align: "center", italic: true },

  { text: "Risk Management", size: "text-4xl sm:text-6xl md:text-7xl", weight: "font-extrabold", font: "font-serif", color: "text-foreground", rotate: -5, align: "center" },

  { text: "Resource Allocation", size: "text-2xl sm:text-4xl md:text-5xl", weight: "font-bold", font: "font-sans", color: "text-accent-foreground", rotate: 7, align: "start", uppercase: true, tracking: "tracking-wider" },

  { text: "Bottleneck", size: "text-xl sm:text-3xl md:text-4xl", weight: "font-light", font: "font-serif", color: "text-muted-foreground/70", rotate: -16, align: "end", italic: true },
];

const alignToFlex: Record<Align, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
};

function ProjectsManagementPage() {
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
          ניהול פרויקטים
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
