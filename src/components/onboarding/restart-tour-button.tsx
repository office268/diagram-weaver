// ============================================================
// src/components/onboarding/restart-tour-button.tsx
// רכיב UI — restart-tour-button
// ============================================================
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useOnboarding } from "./onboarding-provider";

export function RestartTourButton() {
  const { start } = useOnboarding();
  return (
    <Button variant="outline" size="sm" onClick={start}>
      <PlayCircle className="ml-1.5 h-4 w-4" />
      הפעל סיור מודרך
    </Button>
  );
}

export function OnboardingEnabledToggle() {
  const { isEnabled, setEnabled } = useOnboarding();
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="onboarding-enabled"
        checked={isEnabled}
        onCheckedChange={setEnabled}
      />
      <Label htmlFor="onboarding-enabled" className="cursor-pointer text-sm">
        סיור מודרך פעיל אוטומטית למשתמשים חדשים
      </Label>
    </div>
  );
}
