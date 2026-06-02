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

type Word = {
  text: string;
  className: string;
  style: React.CSSProperties;
  delay: number;
};

const words: Word[] = [
  {
    text: "Gantt",
    className:
      "font-serif font-black tracking-tight text-foreground text-6xl sm:text-8xl md:text-9xl",
    style: { top: "42%", left: "50%", transform: "translate(-50%, -50%) rotate(-2deg)" },
    delay: 0,
  },
  {
    text: "Timeline",
    className:
      "font-serif font-bold italic tracking-tight text-primary text-4xl sm:text-6xl md:text-7xl",
    style: { top: "10%", left: "6%", transform: "rotate(-10deg)" },
    delay: 80,
  },
  {
    text: "Milestone",
    className:
      "font-serif font-semibold tracking-tight text-foreground/80 text-3xl sm:text-5xl md:text-6xl",
    style: { top: "16%", right: "5%", transform: "rotate(8deg)" },
    delay: 160,
  },
  {
    text: "Scope",
    className:
      "font-serif font-bold tracking-tight text-primary/80 text-3xl sm:text-5xl md:text-6xl",
    style: {
      top: "52%",
      left: "3%",
      transform: "rotate(-90deg)",
      transformOrigin: "left center",
    },
    delay: 240,
  },
  {
    text: "Risk Management",
    className:
      "font-serif font-semibold tracking-tight text-muted-foreground text-2xl sm:text-4xl md:text-5xl",
    style: {
      top: "55%",
      right: "5%",
      transform: "rotate(90deg)",
      transformOrigin: "right center",
    },
    delay: 320,
  },
  {
    text: "Resource Allocation",
    className:
      "font-serif font-extrabold tracking-tight text-accent-foreground text-2xl sm:text-4xl md:text-5xl",
    style: { bottom: "10%", left: "10%", transform: "rotate(12deg)" },
    delay: 400,
  },
  {
    text: "Velocity",
    className:
      "font-serif font-bold italic tracking-tight text-primary/70 text-3xl sm:text-5xl md:text-6xl",
    style: { bottom: "8%", left: "50%", transform: "translateX(-50%) rotate(-8deg)" },
    delay: 480,
  },
  {
    text: "Bottleneck",
    className:
      "font-serif font-semibold tracking-tight text-foreground/70 text-2xl sm:text-4xl md:text-5xl",
    style: { bottom: "14%", right: "12%", transform: "rotate(18deg)" },
    delay: 560,
  },
  {
    text: "Dependency",
    className:
      "font-serif font-light italic tracking-tight text-foreground/40 text-xl sm:text-3xl md:text-4xl",
    style: { top: "26%", left: "40%", transform: "rotate(-14deg)" },
    delay: 640,
  },
];

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
        <h1 className="mt-2 text-lg sm:text-2xl font-semibold text-foreground">
          כלים ייעודיים לניהול פרויקטים — בקרוב
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
