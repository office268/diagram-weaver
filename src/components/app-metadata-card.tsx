import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, Wand2, Image as ImageIcon, Globe, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getAppMetadata,
  updateAppMetadata,
  generateAppImage,
  type AppMetadata,
} from "@/lib/app-metadata.functions";

export function AppMetadataCard() {
  const qc = useQueryClient();
  const router = useRouter();
  const getFn = useServerFn(getAppMetadata);
  const updateFn = useServerFn(updateAppMetadata);

  const { data, isLoading } = useQuery({
    queryKey: ["app-metadata"],
    queryFn: () => getFn(),
  });

  const [draft, setDraft] = useState<AppMetadata | null>(null);
  const current = draft ?? data ?? null;

  const setField = <K extends keyof AppMetadata>(k: K, v: AppMetadata[K]) => {
    if (!current) return;
    setDraft({ ...current, [k]: v });
  };

  const saveMut = useMutation({
    mutationFn: (m: AppMetadata) => updateFn({ data: m }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-metadata"] });
      router.invalidate();
      setDraft(null);
      toast.success("מטא-דאטא נשמר");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "שמירה נכשלה"),
  });

  if (isLoading || !current) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isDirty = draft !== null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          מטא-דאטא של האפליקציה
        </CardTitle>
        <CardDescription>
          כותרת, תיאור, תגיות שיתוף, פאביקון ותמונת שיתוף — חלים על כל האתר.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Field label="כותרת (title)">
          <Input value={current.title} onChange={(e) => setField("title", e.target.value)} />
        </Field>
        <Field label="תיאור (description)">
          <Textarea
            rows={2}
            value={current.description}
            onChange={(e) => setField("description", e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="og:title">
            <Input
              value={current.og_title}
              placeholder="ברירת מחדל: כותרת"
              onChange={(e) => setField("og_title", e.target.value)}
            />
          </Field>
          <Field label="og:site_name">
            <Input
              value={current.og_site_name}
              onChange={(e) => setField("og_site_name", e.target.value)}
            />
          </Field>
        </div>

        <Field label="og:description">
          <Textarea
            rows={2}
            value={current.og_description}
            placeholder="ברירת מחדל: תיאור"
            onChange={(e) => setField("og_description", e.target.value)}
          />
        </Field>

        <Field label="og:type">
          <Input value={current.og_type} onChange={(e) => setField("og_type", e.target.value)} />
        </Field>

        <AssetField
          label="פאביקון (favicon)"
          kind="favicon"
          value={current.favicon_url}
          onChange={(url) => setField("favicon_url", url)}
        />
        <AssetField
          label="אייקון התקנה בטלפון (apple-touch-icon)"
          kind="apple_touch_icon"
          value={current.apple_touch_icon_url}
          onChange={(url) => setField("apple_touch_icon_url", url)}
        />
        <AssetField
          label="תמונת שיתוף (og:image)"
          kind="og"
          value={current.og_image_url}
          onChange={(url) => setField("og_image_url", url)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!isDirty || saveMut.isPending}
            onClick={() => setDraft(null)}
          >
            ביטול שינויים
          </Button>
          <Button
            size="sm"
            disabled={!isDirty || saveMut.isPending}
            onClick={() => current && saveMut.mutate(current)}
          >
            {saveMut.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            שמור מטא-דאטא
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function AssetField({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: "favicon" | "og" | "apple_touch_icon";
  value: string;
  onChange: (url: string) => void;
}) {
  const genFn = useServerFn(generateAppImage);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  const genMut = useMutation({
    mutationFn: () => genFn({ data: { prompt, kind } }),
    onSuccess: (res: { url: string }) => {
      onChange(res.url);
      setOpen(false);
      setPrompt("");
      toast.success("תמונה נוצרה ושובצה");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "יצירה נכשלה"),
  });

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
          {value ? (
            <img src={value} alt={label} className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <Input
            value={value}
            placeholder="https://..."
            onChange={(e) => onChange(e.target.value)}
            dir="ltr"
          />
          <div className="flex flex-wrap gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" type="button">
                  <Wand2 className="mr-1.5 h-4 w-4" />
                  ייצר עם AI
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    יצירת {kind === "favicon" ? "פאביקון" : kind === "apple_touch_icon" ? "אייקון התקנה" : "תמונת שיתוף"} עם AI
                  </DialogTitle>
                  <DialogDescription>
                    תאר במילים את התמונה הרצויה. היא תיווצר ותשובץ אוטומטית.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    kind === "favicon"
                      ? "לדוגמה: אייקון מינימליסטי של מסמך עם ניצוץ סגול"
                      : kind === "apple_touch_icon"
                        ? "לדוגמה: ריבוע סגול עם אות 'ס' לבנה במרכז"
                        : "לדוגמה: רקע אבסטרקטי כחול-סגול עם הכיתוב 'סוכן ניתוח מערכות'"
                  }
                />
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    disabled={genMut.isPending}
                  >
                    ביטול
                  </Button>
                  <Button
                    onClick={() => genMut.mutate()}
                    disabled={prompt.trim().length < 3 || genMut.isPending}
                  >
                    {genMut.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-1.5 h-4 w-4" />
                    )}
                    ייצר
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button
              size="sm"
              variant="outline"
              type="button"
              disabled={!value}
              onClick={async () => {
                try {
                  const res = await fetch(value);
                  if (!res.ok) throw new Error("הורדה נכשלה");
                  const blob = await res.blob();
                  const ext =
                    (blob.type.split("/")[1] || "png").split(";")[0] || "png";
                  const baseName =
                    kind === "favicon"
                      ? "favicon"
                      : kind === "apple_touch_icon"
                        ? "apple-touch-icon"
                        : "og-image";
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${baseName}.${ext}`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "הורדה נכשלה");
                }
              }}
            >
              <Download className="mr-1.5 h-4 w-4" />
              הורד
            </Button>
          </div>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  יצירת {kind === "favicon" ? "פאביקון" : kind === "apple_touch_icon" ? "אייקון התקנה" : "תמונת שיתוף"} עם AI
                </DialogTitle>
                <DialogDescription>
                  תאר במילים את התמונה הרצויה. היא תיווצר ותשובץ אוטומטית.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                rows={4}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  kind === "favicon"
                    ? "לדוגמה: אייקון מינימליסטי של מסמך עם ניצוץ סגול"
                    : kind === "apple_touch_icon"
                      ? "לדוגמה: ריבוע סגול עם אות 'ס' לבנה במרכז"
                      : "לדוגמה: רקע אבסטרקטי כחול-סגול עם הכיתוב 'סוכן ניתוח מערכות'"
                }
              />
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={genMut.isPending}
                >
                  ביטול
                </Button>
                <Button
                  onClick={() => genMut.mutate()}
                  disabled={prompt.trim().length < 3 || genMut.isPending}
                >
                  {genMut.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="mr-1.5 h-4 w-4" />
                  )}
                  ייצר
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
