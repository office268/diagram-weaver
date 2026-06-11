// ============================================================
// src/hooks/use-pull-to-refresh.ts
// Hook — use-pull-to-refresh
// ============================================================
import { useRef, useState } from "react";

const THRESHOLD = 72;
const MAX_PULL = 120;

interface Options {
  onRefresh: () => Promise<unknown> | void;
}

export function usePullToRefresh({ onRefresh }: Options) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);

  const isEligible = () => {
    if (typeof window === "undefined") return false;
    if (window.scrollY > 0) return false;
    return window.matchMedia("(max-width: 767px)").matches;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (refreshing) return;
    if (!isEligible()) return;
    startY.current = e.touches[0].clientY;
    active.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!active.current || startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      setPullDistance(0);
      return;
    }
    // Easing resistance
    const eased = Math.min(MAX_PULL, dy * 0.5);
    setPullDistance(eased);
  };

  const onTouchEnd = async () => {
    if (!active.current) return;
    active.current = false;
    const dist = pullDistance;
    startY.current = null;
    if (dist >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  return {
    bind: { onTouchStart, onTouchMove, onTouchEnd },
    pullDistance,
    refreshing,
    threshold: THRESHOLD,
  };
}
