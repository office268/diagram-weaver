import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { upsertAgentPersona } from "@/lib/agents.functions";
import { supabase } from "@/integrations/supabase/client";

const AVAILABLE_TOOLS: { id: string; label: string }[] = [
  { id: "org_knowledge", label: "ידע ארגוני" },
  { id: "project_documents", label: "מסמכי פרויקט" },
  { id: "web_search", label: "חיפוש באינטרנט" },
  { id: "create_spec", label: "יצירת מסמך אפיון" },
];

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export interface PersonaDraft {
  id?: string;
  name: string;
  org_id: string | null;
  role_title: string;
  role_description: string;
  knowledge: string;
  tools: string[];
  color: string;
}

const EMPTY: PersonaDraft = {
  name: "",
  org_id: null,
  role_title: "",
  role_description: "",
  knowledge: "",
  tools: [],
  color: COLORS[0],
};

export function AgentPersonaDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: PersonaDraft | null;
}) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertAgentPersona);
  const [draft, setDraft] = useState<PersonaDraft>(EMPTY);

  useEffect(() => {
    if (open) setDraft(initial ?? EMPTY);
  }, [open, initial]);

  const { data: orgs } = useQuery({
    queryKey: ["my-organizations-for-personas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: open,
  });

  const save = useMutation({
    mutationFn: async () => {
      await upsertFn({
        data: {
          id: draft.id,
          name: draft.name.trim(),
          org_id: draft.org_id,
          role_title: draft.role_title.trim(),
          role_description: draft.role_description.trim(),
          knowledge: draft.knowledge.trim(),
          tools: draft.tools,
          color: draft.color,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-personas"] });
      toast.success("נשמר");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שמירה נכשלה"),
  });

  function toggleTool(id: string) {
    setDraft((d) => ({
      ...d,
      tools: d.tools.includes(id) ? d.tools.filter((t) => t !== id) : [...d.tools, id],
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{draft.id ? "עריכת משתמש מערכת" : "הקמת משתמש מערכת חדש"}</DialogTitle>
          <DialogDescription>
            הגדרת סוכן AI: שם, שיוך, תפקיד, תיאור, ידע וכלים. ההגדרות נשלחות למודל בכל פנייה.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>שם *</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                maxLength={120}
                placeholder="לדוגמה: רינת"
              />
            </div>
            <div className="space-y-1.5">
              <Label>שיוך ארגוני</Label>
              <Select
                value={draft.org_id ?? "__none__"}
                onValueChange={(v) =>
                  setDraft({ ...draft, org_id: v === "__none__" ? null : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="ללא" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא</SelectItem>
                  {(orgs ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>תפקיד</Label>
            <Input
              value={draft.role_title}
              onChange={(e) => setDraft({ ...draft, role_title: e.target.value })}
              maxLength={200}
              placeholder="לדוגמה: אנליסטית מערכות בכירה"
            />
          </div>

          <div className="space-y-1.5">
            <Label>תיאור מפורט של התפקיד (Persona)</Label>
            <Textarea
              value={draft.role_description}
              onChange={(e) => setDraft({ ...draft, role_description: e.target.value })}
              maxLength={10000}
              rows={5}
              placeholder="אופי, סגנון תקשורת, אחריות, גישה לבעיות, תחומי מומחיות..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>ידע שעומד לרשותו</Label>
            <Textarea
              value={draft.knowledge}
              onChange={(e) => setDraft({ ...draft, knowledge: e.target.value })}
              maxLength={20000}
              rows={5}
              placeholder="מידע רקע, נהלים, מערכות מוכרות, אילוצים..."
            />
          </div>

          <div className="space-y-2">
            <Label>כלים</Label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_TOOLS.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 rounded-md border border-border p-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={draft.tools.includes(t.id)}
                    onCheckedChange={() => toggleTool(t.id)}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>צבע</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft({ ...draft, color: c })}
                  className={`h-7 w-7 rounded-full border-2 ${draft.color === c ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  aria-label={`צבע ${c}`}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !draft.name.trim()}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            שמירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
