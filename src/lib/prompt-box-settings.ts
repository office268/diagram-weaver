import { useEffect, useState } from "react";

export type UploadKind = "file" | "image" | "link";
export type ChatMode = "auto" | "plan" | "build";

export interface PromptBoxSettings {
  rows: number;
  allowedUploads: Record<UploadKind, boolean>;
  allowedModes: Record<ChatMode, boolean>;
  defaultPlaceholder: string;
}

export const DEFAULT_PROMPT_BOX_SETTINGS: PromptBoxSettings = {
  rows: 1,
  allowedUploads: { file: true, image: true, link: true },
  allowedModes: { auto: true, plan: true, build: true },
  defaultPlaceholder: "",
};

const STORAGE_KEY = "prompt-box-settings";

export function loadPromptBoxSettings(): PromptBoxSettings {
  if (typeof window === "undefined") return DEFAULT_PROMPT_BOX_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROMPT_BOX_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PromptBoxSettings>;
    return {
      rows: clampRows(parsed.rows ?? DEFAULT_PROMPT_BOX_SETTINGS.rows),
      allowedUploads: {
        ...DEFAULT_PROMPT_BOX_SETTINGS.allowedUploads,
        ...(parsed.allowedUploads ?? {}),
      },
      allowedModes: {
        ...DEFAULT_PROMPT_BOX_SETTINGS.allowedModes,
        ...(parsed.allowedModes ?? {}),
      },
      defaultPlaceholder:
        typeof parsed.defaultPlaceholder === "string"
          ? parsed.defaultPlaceholder
          : DEFAULT_PROMPT_BOX_SETTINGS.defaultPlaceholder,
    };
  } catch {
    return DEFAULT_PROMPT_BOX_SETTINGS;
  }
}

export function savePromptBoxSettings(s: PromptBoxSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("prompt-box-settings-changed"));
}

export function clampRows(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(8, Math.round(n)));
}

export function usePromptBoxSettings(): PromptBoxSettings {
  const [s, setS] = useState<PromptBoxSettings>(() => loadPromptBoxSettings());
  useEffect(() => {
    const update = () => setS(loadPromptBoxSettings());
    window.addEventListener("prompt-box-settings-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("prompt-box-settings-changed", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return s;
}
