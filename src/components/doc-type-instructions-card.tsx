import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DOC_TYPES, DOC_TYPE_KEYS, type DocTypeKey } from "@/lib/doc-types";
import {
  listDocTypeInstructions,
  updateDocTypeInstruction,
  resetDocTypeInstruction,
} from "@/lib/doc-type-instructions.functions";

type Row = {
  doc_type: string;
  system_instruction: string;
  default_instruction: string;
  is_default: boolean;
  updated_at: string | null;
};

export function DocTypeInstructionsCard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDocTypeInstructions);
  const updateFn = useServerFn(updateDocTypeInstruction);
  const resetFn = useServerFn(resetDocTypeInstruction);

  const { data, isLoading } = useQuery({
    queryKey: ["doc-type-instructions"],
    queryFn: () => listFn(),
  });

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const row of data as Row[]) {
        if (next[row.doc_type] === undefined) {
          next[row.doc_type] = row.system_instruction;
        }
      }
      return next;
    });
  }, [data]);

  const updateMut = useMutation({
    mutationFn: (payload: { doc_type: DocTypeKey; system_instruction: string }) =>
      updateFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doc-type-instructions"] });
      toast.success("ההוראה נשמרה");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שמירה נכשלה"),
  });

  const resetMut = useMutation({
    mutationFn: (payload: { doc_type: DocTypeKey }) => resetFn({ data: payload }),
    onSuccess: (_res, vars) => {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[vars.doc_type];
        return next;
      });
      qc.invalidateQueries({ queryKey: ["doc-type-instructions"] });
      toast.success("שוחזר לברירת מחדל");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שחזור נכשל"),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rows = data as Row[];
  const byType = new Map(rows.map((r) => [r.doc_type, r]));

  return (
    <Tabs defaultValue={DOC_TYPE_KEYS[0]} className="w-full" dir="rtl">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
        {DOC_TYPE_KEYS.map((key) => (
          <TabsTrigger key={key} value={key} className="text-xs">
            {DOC_TYPES[key].label}
          </TabsTrigger>
        ))}
      </TabsList>

      {DOC_TYPE_KEYS.map((key) => {
        const row = byType.get(key);
        if (!row) return null;
        const draft = drafts[key] ?? row.system_instruction;
        const isDirty = draft !== row.system_instruction;
        const isSaving =
          updateMut.isPending && updateMut.variables?.doc_type === key;
        const isResetting =
          resetMut.isPending && resetMut.variables?.doc_type === key;

        return (
          <TabsContent key={key} value={key} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {DOC_TYPES[key].description}
              </div>
              {row.is_default ? (
                <Badge variant="secondary">ברירת מחדל מהקוד</Badge>
              ) : (
                <Badge>הוראה מותאמת</Badge>
              )}
            </div>

            <Textarea
              value={draft}
              onChange={(e) =>
                setDrafts((prev) => ({ ...prev, [key]: e.target.value }))
              }
              rows={20}
              className="font-mono text-xs leading-relaxed"
              dir="auto"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground" dir="ltr">
                {draft.length} chars
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={row.is_default || isResetting || isSaving}
                  onClick={() => resetMut.mutate({ doc_type: key })}
                >
                  {isResetting ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                  )}
                  שחזר לברירת מחדל
                </Button>
                <Button
                  size="sm"
                  disabled={!isDirty || draft.trim().length < 10 || isSaving}
                  onClick={() =>
                    updateMut.mutate({ doc_type: key, system_instruction: draft })
                  }
                >
                  {isSaving ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-4 w-4" />
                  )}
                  שמור
                </Button>
              </div>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
