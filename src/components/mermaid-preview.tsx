import { useEffect, useRef, useState } from "react";
import { renderMermaid } from "@/lib/mermaid-utils";
import { AlertTriangle, Download, Loader2, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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

    const serialized = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("טעינת התמונה נכשלה"));
      img.src = url;
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
    URL.revokeObjectURL(url);

    const blob: Blob | null = await new Promise((res) =>
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
    toast.error(e instanceof Error ? e.message : "ייצוא נכשל");
  }
}

interface Props {
  code: string;
  onSvg?: (svg: string) => void;
  /** Hide the fullscreen button (e.g. when already rendered inside the fullscreen dialog). */
  hideFullscreen?: boolean;
}

export function MermaidPreview({ code, onSvg, hideFullscreen }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const myId = ++reqId.current;
    setLoading(true);

    const t = setTimeout(async () => {
      const result = await renderMermaid(code);
      if (cancelled || myId !== reqId.current) return;
      if (result.svg) {
        setSvg(result.svg);
        setError(null);
        onSvg?.(result.svg);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [code, onSvg]);

  return (
    <>
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
        <div className="relative flex-1 overflow-hidden">
          {svg ? (
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
                  <div className="absolute right-2 top-2 z-10 flex gap-1 rounded-md border border-border bg-background/90 p-1 shadow-sm backdrop-blur">
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
                    {!hideFullscreen && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setFullscreen(true)}
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
                      className="mermaid-svg flex h-full w-full items-center justify-center p-6 [&_svg]:max-h-full [&_svg]:max-w-full [&_foreignObject]:overflow-visible"
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Type some Mermaid code…"}
            </div>
          )}
        </div>
        {error && (
          <div className="border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <pre className="whitespace-pre-wrap font-mono">{error}</pre>
            </div>
          </div>
        )}
      </div>

      {!hideFullscreen && (
        <Dialog open={fullscreen} onOpenChange={setFullscreen}>
          <DialogContent className="h-[95vh] max-w-[95vw] p-0 sm:max-w-[95vw]">
            <div className="h-full w-full overflow-hidden rounded-lg">
              <MermaidPreview code={code} hideFullscreen />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
