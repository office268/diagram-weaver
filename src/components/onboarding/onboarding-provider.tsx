// ============================================================
// src/components/onboarding/onboarding-provider.tsx
// רכיב UI — onboarding-provider
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  TOUR_STEPS,
  ONBOARDING_STORAGE_KEY,
  ONBOARDING_DISABLED_KEY,
  type TourStep,
} from "./tour-steps";

interface OnboardingContextValue {
  isActive: boolean;
  currentStepIndex: number;
  currentStep: TourStep | null;
  steps: TourStep[];
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
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
  const [isEnabled, setIsEnabledState] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setIsEnabledState(localStorage.getItem(ONBOARDING_DISABLED_KEY) !== "1");
    } catch {
      // ignore
    }
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabledState(enabled);
    try {
      if (enabled) {
        localStorage.removeItem(ONBOARDING_DISABLED_KEY);
      } else {
        localStorage.setItem(ONBOARDING_DISABLED_KEY, "1");
      }
    } catch {
      // ignore
    }
  }, []);

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

  // Auto-start on first visit — but not on routes where it would block primary actions (e.g. /lab)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const path = window.location.pathname;
      if (path.startsWith("/lab")) return;
      const disabled = localStorage.getItem(ONBOARDING_DISABLED_KEY) === "1";
      if (disabled) return;
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
      isEnabled,
      setEnabled,
      start,
      next,
      prev,
      skip,
      complete,
      goTo,
    }),
    [isActive, currentStepIndex, steps, isEnabled, setEnabled, start, next, prev, skip, complete, goTo],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
