import { useEffect, useRef, useState } from "react";
import { renderMermaid } from "@/lib/mermaid-utils";
import { AlertTriangle, Loader2, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

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
                      className="mermaid-svg flex h-full w-full items-center justify-center p-6 [&_svg]:max-h-full [&_svg]:max-w-full [&_foreignObject]:overflow-visible [&_foreignObject_*]:!text-foreground"
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
