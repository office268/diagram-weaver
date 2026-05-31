import { useEffect, useLayoutEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "./onboarding-provider";
import { toast } from "sonner";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;
const TOOLTIP_W = 340;
const TOOLTIP_GAP = 12;

export function OnboardingOverlay() {
  const { isActive, currentStep, currentStepIndex, steps, next, prev, skip, complete } =
    useOnboarding();
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    if (!isActive || !currentStep) {
      setRect(null);
      return;
    }
    const update = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      if (!currentStep.target || currentStep.placement === "center") {
        setRect(null);
        return;
      }
      const el = document.querySelector(currentStep.target) as HTMLElement | null;
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({
        top: r.top - PADDING,
        left: r.left - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
      });
      // Scroll into view if needed
      if (r.top < 0 || r.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    // Small delay for layout to settle (esp. on step change)
    const t = setTimeout(update, 100);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isActive, currentStep]);

  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
      else if (e.key === "ArrowLeft") next(); // RTL: left = next
      else if (e.key === "ArrowRight") prev();
      else if (e.key === "Enter") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isActive, next, prev, skip]);

  if (!isActive || !currentStep) return null;

  const isCenter = !currentStep.target || currentStep.placement === "center" || !rect;
  const isLast = currentStepIndex === steps.length - 1;
  const isFirst = currentStepIndex === 0;

  // Compute tooltip position
  let tooltipStyle: React.CSSProperties = {};
  if (isCenter) {
    tooltipStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: `min(${TOOLTIP_W}px, calc(100vw - 32px))`,
    };
  } else if (rect) {
    const placeBelow =
      currentStep.placement === "bottom" ||
      (currentStep.placement !== "top" && rect.top + rect.height < viewport.h / 2);
    const top = placeBelow ? rect.top + rect.height + TOOLTIP_GAP : Math.max(16, rect.top - TOOLTIP_GAP);
    const translateY = placeBelow ? "0" : "-100%";
    // Center horizontally over target, clamp to viewport
    const desiredLeft = rect.left + rect.width / 2 - TOOLTIP_W / 2;
    const left = Math.max(16, Math.min(viewport.w - TOOLTIP_W - 16, desiredLeft));
    tooltipStyle = {
      top,
      left,
      transform: `translateY(${translateY})`,
      width: `min(${TOOLTIP_W}px, calc(100vw - 32px))`,
    };
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      {/* Spotlight overlays */}
      {isCenter ? (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={skip} />
      ) : rect ? (
        <>
          {/* top */}
          <div
            className="absolute bg-background/80 backdrop-blur-sm transition-all"
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top) }}
            onClick={skip}
          />
          {/* bottom */}
          <div
            className="absolute bg-background/80 backdrop-blur-sm transition-all"
            style={{
              top: rect.top + rect.height,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onClick={skip}
          />
          {/* left */}
          <div
            className="absolute bg-background/80 backdrop-blur-sm transition-all"
            style={{
              top: rect.top,
              left: 0,
              width: Math.max(0, rect.left),
              height: rect.height,
            }}
            onClick={skip}
          />
          {/* right */}
          <div
            className="absolute bg-background/80 backdrop-blur-sm transition-all"
            style={{
              top: rect.top,
              left: rect.left + rect.width,
              right: 0,
              height: rect.height,
            }}
            onClick={skip}
          />
          {/* spotlight ring */}
          <div
            className="pointer-events-none absolute rounded-lg ring-2 ring-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.25)] transition-all"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
          />
        </>
      ) : null}

      {/* Tooltip */}
      <div
        className="absolute rounded-xl border border-border bg-card text-card-foreground shadow-2xl animate-fade-in"
        style={tooltipStyle}
      >
        <div className="p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                שלב {currentStepIndex + 1} מתוך {steps.length}
              </span>
            </div>
            <button
              type="button"
              onClick={skip}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="סגור סיור"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h3 id="onboarding-title" className="text-base font-semibold text-foreground">
            {currentStep.title}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {currentStep.description}
          </p>

          {/* Progress dots */}
          <div className="mt-4 flex items-center gap-1.5">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === currentStepIndex
                    ? "w-6 bg-primary"
                    : i < currentStepIndex
                      ? "w-1.5 bg-primary/60"
                      : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={skip}>
              דלג
            </Button>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button variant="outline" size="sm" onClick={prev}>
                  <ChevronRight className="ml-1 h-4 w-4" />
                  הקודם
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  if (isLast) {
                    complete();
                    toast.success("סיור הושלם 🎉");
                  } else {
                    next();
                  }
                }}
              >
                {isLast ? "סיימתי" : "הבא"}
                {!isLast && <ChevronLeft className="mr-1 h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
