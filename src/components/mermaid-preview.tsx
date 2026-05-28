import { useEffect, useRef, useState } from "react";
import { renderMermaid } from "@/lib/mermaid-utils";
import { AlertTriangle, Loader2 } from "lucide-react";

interface Props {
  code: string;
  onSvg?: (svg: string) => void;
}

export function MermaidPreview({ code, onSvg }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="relative flex-1 overflow-auto p-6">
        {svg ? (
          <div
            className="mermaid-svg flex h-full w-full items-center justify-center [&_svg]:max-h-full [&_svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
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
  );
}
