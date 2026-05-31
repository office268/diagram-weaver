import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TOUR_STEPS, ONBOARDING_STORAGE_KEY, type TourStep } from "./tour-steps";

interface OnboardingContextValue {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: TourStep | null;
  steps: TourStep[];
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  complete: () => void;
  goTo: (index: number) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function getVisibleSteps(): TourStep[] {
  if (typeof window === "undefined") return TOUR_STEPS;
  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  return TOUR_STEPS.filter((s) => {
    if (s.mobileOnly && !isMobile) return false;
    if (s.desktopOnly && isMobile) return false;
    return true;
  });
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<TourStep[]>(TOUR_STEPS);

  const start = useCallback(() => {
    setSteps(getVisibleSteps());
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const complete = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setIsActive(false);
    setCurrentStepIndex(0);
  }, []);

  const skip = useCallback(() => {
    complete();
  }, [complete]);

  const next = useCallback(() => {
    setCurrentStepIndex((i) => {
      if (i >= steps.length - 1) {
        complete();
        return i;
      }
      return i + 1;
    });
  }, [steps.length, complete]);

  const prev = useCallback(() => {
    setCurrentStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const goTo = useCallback(
    (index: number) => {
      if (index >= 0 && index < steps.length) setCurrentStepIndex(index);
    },
    [steps.length],
  );

  // Auto-start on first visit
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const done = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!done) {
        const t = setTimeout(() => start(), 600);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore
    }
  }, [start]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      isActive,
      currentStepIndex,
      currentStep: isActive ? steps[currentStepIndex] ?? null : null,
      steps,
      start,
      next,
      prev,
      skip,
      complete,
      goTo,
    }),
    [isActive, currentStepIndex, steps, start, next, prev, skip, complete, goTo],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
