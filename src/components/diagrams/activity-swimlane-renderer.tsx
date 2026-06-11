// ============================================================
// src/components/activity-swimlane-renderer.tsx
// רכיב UI — activity-swimlane-renderer
// ============================================================
import { useCallback, useMemo, useState } from "react";
import { sanitizeSvg } from "@/lib/svg-sanitize";
import { ActivityRFEditor } from "@/components/diagrams/activity-rf-editor";
import { parseSvgToRF, isActivityRF, type ActivityRFData } from "@/lib/diagrams/activity-rf";
import { Download, Maximize2, Minus, Pencil, Plus, RotateCcw } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

function downloadSvg(svgMarkup: string) {
  const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `diagram-${Date.now()}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function exportSvgAsJpg(svgMarkup: string) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgMarkup, "image/svg+xml");
    const svgEl = doc.documentElement as unknown as SVGSVGElement;
    if (!svgEl || svgEl.nodeName === "parsererror") throw new Error("SVG לא תקין");

    const vb = svgEl.getAttribute("viewBox")?.split(/\s+/).map(Number);
    let width  = parseFloat(svgEl.getAttribute("width")  || "") || (vb && vb[2]) || 1200;
    let height = parseFloat(svgEl.getAttribute("height") || "") || (vb && vb[3]) || 800;
    if (!Number.isFinite(width)  || width  <= 0) width  = 1200;
    if (!Number.isFinite(height) || height <= 0) height = 800;

    svgEl.setAttribute("width",  String(width));
    svgEl.setAttribute("height", String(height));
    if (!svgEl.getAttribute("xmlns")) svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const serialized =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      new XMLSerializer().serializeToString(svgEl);
    const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(serialized);

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("טעינת התמונה נכשלה"));
      img.src = dataUrl;
    });

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width  = Math.ceil(width  * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas לא נתמך");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>(res =>
      canvas.toBlob(b => res(b), "image/jpeg", 0.95),
    );
    if (!blob) throw new Error("יצירת JPG נכשלה");
    const dlUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = `diagram-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(dlUrl);
  } catch (e) {
    try {
      downloadSvg(svgMarkup);
      toast.message("ייצוא כתמונה נכשל — הורד כ-SVG");
    } catch {
      toast.error(e instanceof Error ? e.message : "ייצוא נכשל");
    }
  }
}

// ── SVG viewer (read-only) ─────────────────────────────────────────────────

interface SvgViewerProps {
  svg: string;
  hideFullscreen?: boolean;
  onFullscreen?: () => void;
  onEdit?: () => void;
}

function SvgViewer({ svg, hideFullscreen, onFullscreen, onEdit }: SvgViewerProps) {
  return (
    <TransformWrapper
      minScale={0.3} maxScale={6} initialScale={1}
      centerOnInit wheel={{ step: 0.15 }} pinch={{ step: 5 }}
      doubleClick={{ mode: "toggle", step: 1.5 }}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <>
          {onEdit && (
            <div className="absolute right-3 top-3 z-10">
              <Button size="sm" variant="outline" className="gap-1.5 shadow-sm" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
                ערוך תרשים
              </Button>
            </div>
          )}
          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-md border border-border bg-background/90 p-1 shadow-sm backdrop-blur">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => zoomIn()}        aria-label="הגדל"><Plus     className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => zoomOut()}       aria-label="הקטן"><Minus    className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => resetTransform()} aria-label="איפוס"><RotateCcw className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => exportSvgAsJpg(svg)} aria-label="ייצוא" title="ייצוא כ-JPG"><Download className="h-4 w-4" /></Button>
            {!hideFullscreen && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onFullscreen} aria-label="מסך מלא"><Maximize2 className="h-4 w-4" /></Button>
            )}
          </div>
          <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full">
            <div
              className="flex h-full w-full items-center justify-center p-6 [&_svg]:max-h-full [&_svg]:max-w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </TransformComponent>
        </>
      )}
    </TransformWrapper>
  );
}

// ── React Flow viewer (read-only) ──────────────────────────────────────────

function RFViewer({ rfData, onEdit }: { rfData: ActivityRFData; onEdit?: () => void }) {
  return (
    <div className="relative h-full w-full">
      {onEdit && (
        <div className="absolute right-3 top-3 z-10">
          <Button size="sm" variant="outline" className="gap-1.5 shadow-sm" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
            ערוך תרשים
          </Button>
        </div>
      )}
      <ActivityRFEditor rfData={rfData} onSave={() => {}} saving={false} readOnly />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export interface ActivitySwimlaneRendererProps {
  code: string;
  hideFullscreen?: boolean;
  onSave?: (newCode: string) => Promise<void>;
}

export function ActivitySwimlaneRenderer({
  code,
  hideFullscreen,
  onSave,
}: ActivitySwimlaneRendererProps) {
  const [editing, setEditing]   = useState(false);
  const [saving,  setSaving]    = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const isSvg = code.trimStart().toLowerCase().startsWith("<svg");
  const isRF  = isActivityRF(code);

  const safeSvg = useMemo(
    () => (isSvg ? sanitizeSvg(code) : null),
    [isSvg, code],
  );

  const rfData = useMemo((): ActivityRFData | null => {
    if (isRF) {
      try { return JSON.parse(code) as ActivityRFData; } catch { return null; }
    }
    return null;
  }, [isRF, code]);

  // Convert SVG → RF lazily when user clicks Edit
  const [convertedRF, setConvertedRF] = useState<ActivityRFData | null>(null);

  const handleEdit = useCallback(() => {
    if (isRF && rfData) {
      setEditing(true);
      return;
    }
    if (isSvg && safeSvg) {
      const parsed = parseSvgToRF(safeSvg);
      const nonLane = parsed?.nodes.filter(n => n.data.nodeType !== "lane").length ?? 0;
      if (!parsed || nonLane < 3) {
        toast.error("לא ניתן להמיר את התרשים לפורמט ניתן לעריכה");
        return;
      }
      setConvertedRF(parsed);
      setEditing(true);
    }
  }, [isRF, rfData, isSvg, safeSvg]);

  const activeRF: ActivityRFData | null = isRF ? rfData : convertedRF;

  const handleSave = useCallback(async (updated: ActivityRFData) => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(JSON.stringify(updated));
      toast.success("התרשים נשמר");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  // ── Editing mode ──────────────────────────────────────────────────────────
  if (editing && activeRF) {
    return (
      <div className="relative h-full w-full">
        <div className="absolute left-2 top-2 z-20">
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
            ← חזרה לתצוגה
          </Button>
        </div>
        <ActivityRFEditor rfData={activeRF} onSave={handleSave} saving={saving} />
      </div>
    );
  }

  // ── RF viewer (saved editable diagram) ────────────────────────────────────
  if (isRF && rfData) {
    return (
      <>
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
          <div className="relative flex-1 overflow-hidden">
            <RFViewer rfData={rfData} onEdit={onSave ? handleEdit : undefined} />
          </div>
        </div>
        {!hideFullscreen && (
          <Dialog open={fullscreen} onOpenChange={setFullscreen}>
            <DialogContent className="h-[95vh] max-w-[95vw] p-0 sm:max-w-[95vw]">
              <DialogTitle className="sr-only">תצוגת תרשים במסך מלא</DialogTitle>
              <DialogDescription className="sr-only">תצוגה מלאה של התרשים לצפייה נוחה.</DialogDescription>
              <div className="h-full w-full overflow-hidden rounded-lg">
                <ActivitySwimlaneRenderer code={code} hideFullscreen />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  // ── SVG viewer ────────────────────────────────────────────────────────────
  if (isSvg && safeSvg) {
    return (
      <>
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
          <div className="relative flex-1 overflow-hidden">
            <SvgViewer
              svg={safeSvg}
              hideFullscreen={hideFullscreen}
              onFullscreen={() => setFullscreen(true)}
              onEdit={onSave ? handleEdit : undefined}
            />
          </div>
        </div>
        {!hideFullscreen && (
          <Dialog open={fullscreen} onOpenChange={setFullscreen}>
            <DialogContent className="h-[95vh] max-w-[95vw] p-0 sm:max-w-[95vw]">
              <DialogTitle className="sr-only">תצוגת תרשים במסך מלא</DialogTitle>
              <DialogDescription className="sr-only">תצוגה מלאה של התרשים לצפייה נוחה.</DialogDescription>
              <div className="h-full w-full overflow-hidden rounded-lg">
                <ActivitySwimlaneRenderer code={code} hideFullscreen />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  // ── Unsupported format fallback ───────────────────────────────────────────
  return (
    <div className="flex h-full w-full items-center justify-center p-6 text-sm text-muted-foreground">
      פורמט התרשים אינו נתמך.
    </div>
  );
}
