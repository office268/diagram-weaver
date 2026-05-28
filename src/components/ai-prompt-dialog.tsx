import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIAGRAM_TEMPLATES } from "@/lib/mermaid-utils";
import { generateDiagramFromPrompt } from "@/lib/ai-diagram.functions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected diagram type. If provided, type picker stays editable. */
  defaultType?: string;
  /** If provided, enables a "refine current" toggle. */
  existingCode?: string;
  /** Called with the generated code + title. */
  onGenerated: (result: { code: string; title: string; diagram_type: string }) => void;
}

export function AiPromptDialog({
  open,
  onOpenChange,
  defaultType = "flowchart",
  existingCode,
  onGenerated,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState(defaultType);
  const [refine, setRefine] = useState(false);

  const genFn = useServerFn(generateDiagramFromPrompt);

  const mut = useMutation({
    mutationFn: () =>
      genFn({
        data: {
          prompt,
          diagram_type: type,
          existingCode: refine && existingCode ? existingCode : undefined,
        },
      }),
    onSuccess: (res) => {
      onGenerated({ ...res, diagram_type: type });
      setPrompt("");
      setRefine(false);
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !mut.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Generate diagram with AI
          </DialogTitle>
          <DialogDescription>
            Describe the diagram in plain language. The AI will generate Mermaid code for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai-type">Diagram type</Label>
            <Select value={type} onValueChange={setType} disabled={refine}>
              <SelectTrigger id="ai-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DIAGRAM_TEMPLATES).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ai-prompt">Description</Label>
            <Textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                refine
                  ? "e.g. Add a payment confirmation step after checkout"
                  : "e.g. User onboarding flow with email verification and plan selection"
              }
              rows={5}
              maxLength={2000}
              autoFocus
            />
            <div className="text-right text-xs text-muted-foreground">
              {prompt.length} / 2000
            </div>
          </div>

          {existingCode && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={refine}
                onChange={(e) => setRefine(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Refine the current diagram instead of starting fresh
            </label>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mut.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!prompt.trim() || mut.isPending}
          >
            {mut.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
