import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
