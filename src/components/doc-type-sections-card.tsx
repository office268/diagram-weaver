// ============================================================
// src/components/doc-type-sections-card.tsx
// רכיב UI — doc-type-sections-card
// ============================================================
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";

import {
  ALL_SECTION_KEYS,
  DEFAULT_SECTION_TITLES,
  DOC_TYPES,
  DOC_TYPE_KEYS,
  type DocTypeKey,
} from "@/lib/doc-types";
import {
  listDocTypeSettings,
  updateDocTypeSettings,
  resetDocTypeSettings,
  effectiveDocTypeConfig,
} from "@/lib/doc-type-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export function DocTypeSectionsCard() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDocTypeSettings);
  const updateFn = useServerFn(updateDocTypeSettings);
  const resetFn = useServerFn(resetDocTypeSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["doc-type-settings"],
    queryFn: () => listFn(),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>סעיפי ברירת מחדל לפי סוג מסמך</CardTitle>
        <CardDescription>
          הגדירו אילו סעיפים יופיעו (ובאיזה סדר וכותרת) בכל יצירת מסמך חדש מסוג מסוים.
          ההגדרות חלות רק על מסמכים חדשים — לא משנות מסמכים קיימים.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {DOC_TYPE_KEYS.map((key) => (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger className="text-right">
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="font-medium">{DOC_TYPES[key].label}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {data.overrides[key] ? "מותאם אישית" : "ברירת מחדל"}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <DocTypeEditor
                    docType={key}
                    override={data.overrides[key] ?? null}
                    onSave={async (payload) => {
                      await updateFn({ data: payload });
                      qc.invalidateQueries({ queryKey: ["doc-type-settings"] });
                      toast.success("נשמר");
                    }}
                    onReset={async () => {
                      await resetFn({ data: { docType: key } });
                      qc.invalidateQueries({ queryKey: ["doc-type-settings"] });
                      toast.success("שוחזר לברירת מחדל");
                    }}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

interface EditorProps {
  docType: DocTypeKey;
  override: {
    doc_type: DocTypeKey;
    section_order: string[];
    section_titles: Record<string, string>;
  } | null;
  onSave: (payload: {
    docType: DocTypeKey;
    sectionOrder: string[];
    sectionTitles: Record<string, string>;
  }) => Promise<void>;
  onReset: () => Promise<void>;
}

function DocTypeEditor({ docType, override, onSave, onReset }: EditorProps) {
  const effective = useMemo(
    () => effectiveDocTypeConfig(docType, override),
    [docType, override],
  );

  const [order, setOrder] = useState<string[]>(effective.sectionOrder);
  const [titles, setTitles] = useState<Record<string, string>>(
    effective.sectionTitles,
  );
  const [addKey, setAddKey] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setOrder(effective.sectionOrder);
    setTitles(effective.sectionTitles);
  }, [effective]);

  const available = ALL_SECTION_KEYS.filter((k) => !order.includes(k));

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[idx], next[j]] = [next[j], next[idx]];
    setOrder(next);
  };

  const remove = (key: string) => {
    setOrder((prev) => prev.filter((k) => k !== key));
    setTitles((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const add = () => {
    if (!addKey) return;
    setOrder((prev) => [...prev, addKey]);
    setAddKey("");
  };

  const setTitle = (key: string, value: string) => {
    setTitles((prev) => {
      const next = { ...prev };
      if (!value.trim()) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  return (
    <div className="space-y-3 pt-2">
      <ul className="space-y-2">
        {order.map((key, idx) => (
          <li
            key={key}
            className="flex items-center gap-2 rounded-md border border-border bg-card p-2"
          >
            <div className="flex flex-col">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 w-7 p-0"
                disabled={idx === 0}
                onClick={() => move(idx, -1)}
                aria-label="הזז למעלה"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 w-7 p-0"
                disabled={idx === order.length - 1}
                onClick={() => move(idx, 1)}
                aria-label="הזז למטה"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex-1 space-y-1">
              <div className="text-[10px] font-mono text-muted-foreground" dir="ltr">
                {key}
              </div>
              <Input
                value={titles[key] ?? DEFAULT_SECTION_TITLES[key] ?? key}
                onChange={(e) => setTitle(key, e.target.value)}
                placeholder={DEFAULT_SECTION_TITLES[key] ?? key}
                className="h-8 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => remove(key)}
              aria-label="הסר סעיף"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
        {order.length === 0 && (
          <li className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            אין סעיפים. הוסיפו לפחות סעיף אחד.
          </li>
        )}
      </ul>

      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={addKey} onValueChange={setAddKey}>
            <SelectTrigger className="h-8 max-w-xs text-sm">
              <SelectValue placeholder="בחר סעיף להוספה..." />
            </SelectTrigger>
            <SelectContent>
              {available.map((k) => (
                <SelectItem key={k} value={k}>
                  {DEFAULT_SECTION_TITLES[k] ?? k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={!addKey}>
            <Plus className="mr-1 h-4 w-4" /> הוסף
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
        {override && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={resetting || saving}
            onClick={async () => {
              setResetting(true);
              try {
                await onReset();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "שחזור נכשל");
              } finally {
                setResetting(false);
              }
            }}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" /> שחזר לברירת מחדל
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          disabled={saving || resetting || order.length === 0}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave({
                docType,
                sectionOrder: order,
                sectionTitles: titles,
              });
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          שמור
        </Button>
      </div>
    </div>
  );
}
