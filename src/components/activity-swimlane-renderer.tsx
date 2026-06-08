import { useMemo, useState } from "react";
import { sanitizeMermaidSvg } from "@/lib/mermaid-utils";
import { MermaidPreview } from "@/components/mermaid-preview";
import { Download, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
    let width = parseFloat(svgEl.getAttribute("width") || "") || (vb && vb[2]) || 1200;
    let height = parseFloat(svgEl.getAttribute("height") || "") || (vb && vb[3]) || 800;
    if (!Number.isFinite(width) || width <= 0) width = 1200;
    if (!Number.isFinite(height) || height <= 0) height = 800;

    svgEl.setAttribute("width", String(width));
    svgEl.setAttribute("height", String(height));
    if (!svgEl.getAttribute("xmlns")) svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    const serialized =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      new XMLSerializer().serializeToString(svgEl);
    const dataUrl =
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(serialized);

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("טעינת התמונה נכשלה"));
      img.src = dataUrl;
    });

    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas לא נתמך");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", 0.95),
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

interface SvgViewerProps {
  svg: string;
  hideFullscreen?: boolean;
  onFullscreen?: () => void;
}

function SvgViewer({ svg, hideFullscreen, onFullscreen }: SvgViewerProps) {
  return (
    <TransformWrapper
      minScale={0.3}
      maxScale={6}
      initialScale={1}
      centerOnInit
      wheel={{ step: 0.15 }}
      pinch={{ step: 5 }}
      doubleClick={{ mode: "toggle", step: 1.5 }}
    >
      {({ zoomIn, zoomOut, resetTransform }) => (
        <>
          <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-md border border-border bg-background/90 p-1 shadow-sm backdrop-blur">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => zoomIn()}
              aria-label="הגדל"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => zoomOut()}
              aria-label="הקטן"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => resetTransform()}
              aria-label="איפוס"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => exportSvgAsJpg(svg)}
              aria-label="ייצוא כ-JPG"
              title="ייצוא כ-JPG"
            >
              <Download className="h-4 w-4" />
            </Button>
            {!hideFullscreen && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={onFullscreen}
                aria-label="מסך מלא"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <TransformComponent
            wrapperClass="!h-full !w-full"
            contentClass="!h-full !w-full"
          >
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

interface Props {
  code: string;
  hideFullscreen?: boolean;
}

export function ActivitySwimlaneRenderer({ code, hideFullscreen }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  const isSvg = code.trimStart().toLowerCase().startsWith("<svg");

  const safeSvg = useMemo(
    () => (isSvg ? sanitizeMermaidSvg(code) : null),
    [isSvg, code],
  );

  if (!isSvg) {
    return <MermaidPreview code={code} hideFullscreen={hideFullscreen} />;
  }

  if (!safeSvg) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        תרשים SVG לא תקין
      </div>
    );
  }

  return (
    <>
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
        <div className="relative flex-1 overflow-hidden">
          <SvgViewer
            svg={safeSvg}
            hideFullscreen={hideFullscreen}
            onFullscreen={() => setFullscreen(true)}
          />
        </div>
      </div>

      {!hideFullscreen && (
        <Dialog open={fullscreen} onOpenChange={setFullscreen}>
          <DialogContent className="h-[95vh] max-w-[95vw] p-0 sm:max-w-[95vw]">
            <div className="h-full w-full overflow-hidden rounded-lg">
              <ActivitySwimlaneRenderer code={code} hideFullscreen />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
