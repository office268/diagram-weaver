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
import { upsertAgentPersona, suggestPersonaField } from "@/lib/agents.functions";
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
  const suggestFn = useServerFn(suggestPersonaField);
  const [draft, setDraft] = useState<PersonaDraft>(EMPTY);
  const [orgIdText, setOrgIdText] = useState("");
  const [suggesting, setSuggesting] = useState<"name" | "role_description" | "knowledge" | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial ?? EMPTY);
      setOrgIdText("");
    }
  }, [open, initial]);

  async function handleSuggest(field: "name" | "role_description" | "knowledge") {
    try {
      setSuggesting(field);
      const { text } = await suggestFn({
        data: {
          field,
          name: draft.name,
          role_title: draft.role_title,
          role_description: draft.role_description,
          org_name: "",
        },
      });
      if (text) setDraft((d) => ({ ...d, [field]: text }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "יצירה נכשלה");
    } finally {
      setSuggesting(null);
    }
  }


  const { data: orgs } = useQuery({
    queryKey: ["my-organizations-for-personas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, identifier")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: open,
  });

  // Populate the ח.פ. text field when editing, based on current org_id
  useEffect(() => {
    if (!open) return;
    if (!draft.org_id) return;
    const found = (orgs ?? []).find((o) => o.id === draft.org_id);
    if (found && found.identifier && !orgIdText) {
      setOrgIdText(found.identifier);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, orgs, draft.org_id]);

  const save = useMutation({
    mutationFn: async () => {
      const trimmedId = orgIdText.trim();
      let finalOrgId: string | null = draft.org_id;
      if (trimmedId) {
        const match = (orgs ?? []).find((o) => (o.identifier ?? "").trim() === trimmedId);
        if (!match) throw new Error("לא נמצא ארגון עם ח.פ. זה");
        finalOrgId = match.id;
      }
      await upsertFn({
        data: {
          id: draft.id,
          name: draft.name.trim(),
          org_id: finalOrgId,
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
              <div className="flex gap-2">
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  maxLength={120}
                  placeholder="לדוגמה: רינת"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleSuggest("name")}
                  disabled={suggesting !== null}
                  title="הצע שם באמצעות AI"
                >
                  {suggesting === "name" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>שיוך ארגוני</Label>
              <Select
                value={draft.org_id ?? "__none__"}
                onValueChange={(v) => {
                  const id = v === "__none__" ? null : v;
                  setDraft({ ...draft, org_id: id });
                  setOrgIdText(id ?? "");
                }}
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
            <Label>מזהה ארגון (UUID)</Label>
            <Input
              value={orgIdText}
              onChange={(e) => setOrgIdText(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              dir="ltr"
            />
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
            <div className="flex items-center justify-between">
              <Label>תיאור מפורט של התפקיד (Persona)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSuggest("role_description")}
                disabled={suggesting !== null}
              >
                {suggesting === "role_description" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="ms-1">מילוי אוטומטי</span>
              </Button>
            </div>
            <Textarea
              value={draft.role_description}
              onChange={(e) => setDraft({ ...draft, role_description: e.target.value })}
              maxLength={10000}
              rows={5}
              placeholder="אופי, סגנון תקשורת, אחריות, גישה לבעיות, תחומי מומחיות..."
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>ידע שעומד לרשותו</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleSuggest("knowledge")}
                disabled={suggesting !== null}
              >
                {suggesting === "knowledge" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="ms-1">מילוי אוטומטי</span>
              </Button>
            </div>
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
