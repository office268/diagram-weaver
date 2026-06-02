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
  color: string;
  rotate: number;
  align: Align;
  italic?: boolean;
};

const words: Word[] = [
  { text: "Gantt", size: "text-4xl sm:text-7xl md:text-8xl font-black", color: "text-foreground", rotate: -2, align: "center" },
  { text: "Timeline", size: "text-3xl sm:text-5xl md:text-6xl font-bold", color: "text-primary", rotate: -8, align: "start", italic: true },
  { text: "Milestone", size: "text-3xl sm:text-5xl md:text-6xl font-semibold", color: "text-foreground/80", rotate: 6, align: "end" },
  { text: "Scope", size: "text-3xl sm:text-5xl md:text-6xl font-bold", color: "text-primary/80", rotate: -10, align: "start" },
  { text: "Risk Management", size: "text-2xl sm:text-4xl md:text-5xl font-semibold", color: "text-accent-foreground", rotate: 4, align: "center" },
  { text: "Velocity", size: "text-2xl sm:text-4xl md:text-5xl font-bold", color: "text-primary/90", rotate: -6, align: "end", italic: true },
  { text: "Resource Allocation", size: "text-xl sm:text-3xl md:text-4xl font-extrabold", color: "text-foreground", rotate: 8, align: "start" },
  { text: "Bottleneck", size: "text-2xl sm:text-4xl md:text-5xl font-semibold", color: "text-foreground/70", rotate: 12, align: "end" },
  { text: "Dependency", size: "text-xl sm:text-3xl md:text-4xl font-light", color: "text-muted-foreground", rotate: -14, align: "center", italic: true },
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
