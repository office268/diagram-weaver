// ============================================================
// src/hooks/use-prompt-history.ts
// Hook — use-prompt-history
// ============================================================
import { useCallback, useEffect, useState } from "react";

const MAX = 5;
const PREFIX = "spec-ai-prompt-history:";

function load(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

function save(key: string, items: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(items.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

export function usePromptHistory(key: string) {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    setItems(load(key));
  }, [key]);

  const add = useCallback(
    (prompt: string) => {
      const v = prompt.trim();
      if (!v) return;
      setItems((prev) => {
        const next = [v, ...prev.filter((p) => p !== v)].slice(0, MAX);
        save(key, next);
        return next;
      });
    },
    [key],
  );

  const remove = useCallback(
    (prompt: string) => {
      setItems((prev) => {
        const next = prev.filter((p) => p !== prompt);
        save(key, next);
        return next;
      });
    },
    [key],
  );

  return { items, add, remove };
}
