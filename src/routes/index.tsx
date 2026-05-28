import { createFileRoute, Link } from "@tanstack/react-router";
import { GitBranch, Code2, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mermaid Studio — Visual diagram editor" },
      {
        name: "description",
        content:
          "Design Mermaid diagrams visually and edit the source side-by-side. Save to the cloud and export to SVG, JPG, or .mmd.",
      },
      { property: "og:title", content: "Mermaid Studio" },
      {
        property: "og:description",
        content: "Visual + code editor for Mermaid diagrams.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <GitBranch className="h-5 w-5 text-primary" />
            Mermaid Studio
          </div>
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign in</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Visual & code, in sync
          </div>
          <h1 className="text-balance text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
            Diagrams that write themselves.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            A graphical editor for Mermaid. Edit visually, tweak the code, see both update
            instantly. Save your diagrams to the cloud and export to SVG, JPG or .mmd.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/login">
              <Button size="lg">Start creating</Button>
            </Link>
            <a
              href="https://mermaid.js.org/intro/"
              target="_blank"
              rel="noreferrer"
            >
              <Button size="lg" variant="outline">Learn Mermaid</Button>
            </a>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-24 sm:grid-cols-3">
          <Feature
            icon={<GitBranch className="h-5 w-5 text-primary" />}
            title="All diagram types"
            text="Flowcharts, sequence, class, state, ER, Gantt, and activity with swim-lanes."
          />
          <Feature
            icon={<Code2 className="h-5 w-5 text-primary" />}
            title="Live two-way sync"
            text="Type code, watch the canvas. Click on the canvas, watch the code."
          />
          <Feature
            icon={<Download className="h-5 w-5 text-primary" />}
            title="Export anywhere"
            text="Download as SVG, JPG, or raw Mermaid source — no lock-in."
          />
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-center text-sm text-muted-foreground">
          Built with Mermaid · Powered by Lovable Cloud
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
        {icon}
      </div>
      <h3 className="font-medium text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
