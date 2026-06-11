// ============================================================
// src/components/ui/theme-toggle.tsx
// רכיב UI — theme-toggle
// ============================================================
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      className={className}
      aria-label={isDark ? "מצב בהיר" : "מצב כהה"}
      title={isDark ? "מצב בהיר" : "מצב כהה"}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
