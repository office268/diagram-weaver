import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  Loader2,
  Save,
  Check,
  FileImage,
  FileCode2,
  FileText,
  Sparkles,
} from "lucide-react";
import { AiPromptDialog } from "@/components/ai-prompt-dialog";

import {
  getDiagram,
  updateDiagram,
} from "@/lib/diagrams.functions";
import { MermaidPreview } from "@/components/mermaid-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DIAGRAM_TEMPLATES } from "@/lib/mermaid-utils";
import { downloadSvg, downloadText, svgToJpg } from "@/lib/export-utils";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/editor/$id")({
  head: () => ({
    meta: [
      { title: "עורך תרשים — סוכן ניתוח מערכות" },
      {
        name: "description",
        content: "עריכת תרשים ניתוח מערכות עם תצוגה ויזואלית וקוד Mermaid זה לצד זה.",
      },
      { property: "og:title", content: "עורך תרשים — סוכן ניתוח מערכות" },
    ],
  }),
  component: EditorPage,
});


function EditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getDiagram);
  const updateFn = useServerFn(updateDiagram);
  const isMobile = useIsMobile();

  const { data, isLoading, error } = useQuery({
    queryKey: ["diagram", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("flowchart");
  const [svg, setSvg] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const lastSentRef = useRef<string>("");
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (data?.diagram) {
      setTitle(data.diagram.title);
      setCode(data.diagram.code);
      setType(data.diagram.diagram_type);
      lastSentRef.current = JSON.stringify({
        title: data.diagram.title,
        code: data.diagram.code,
        diagram_type: data.diagram.diagram_type,
      });
    }
  }, [data?.diagram]);

  const saveMut = useMutation({
    mutationFn: (patch: { title?: string; code?: string; diagram_type?: string }) =>
      updateFn({ data: { id, ...patch } }),
    onMutate: () => setSaveState("saving"),
    onSuccess: () => {
      setSaveState("saved");
      qc.invalidateQueries({ queryKey: ["diagrams"] });
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
    },
    onError: (e) => {
      setSaveState("idle");
      toast.error(e instanceof Error ? e.message : "Failed to save");
    },
  });

  // Debounced autosave
  useEffect(() => {
    if (!data?.diagram) return;
    const snapshot = JSON.stringify({ title, code, diagram_type: type });
    if (snapshot === lastSentRef.current) return;
    const t = setTimeout(() => {
      lastSentRef.current = snapshot;
      saveMut.mutate({ title, code, diagram_type: type });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, code, type, data?.diagram]);

  const handleSvgReady = useCallback((s: string) => setSvg(s), []);

  const safeName = useMemo(
    () => (title || "diagram").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "diagram",
    [title],
  );

  const handleExportSvg = () => {
    if (!svg) return toast.error("Nothing to export yet");
    downloadSvg(svg, `${safeName}.svg`);
  };
  const handleExportJpg = async () => {
    if (!svg) return toast.error("Nothing to export yet");
    try {
      await svgToJpg(svg, `${safeName}.jpg`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  };
  const handleExportMmd = () => {
    downloadText(code, `${safeName}.mmd`);
  };

  const handleTemplateSwap = (newType: string) => {
    setType(newType);
    const tpl = DIAGRAM_TEMPLATES[newType];
    if (tpl) setCode(tpl.code);
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-57px)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || !data?.diagram) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-sm text-destructive">
          {(error as Error)?.message ?? "Diagram not found"}
        </p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm text-primary underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const codeEditor = (
    <CodeMirror
      value={code}
      onChange={setCode}
      height="100%"
      theme="light"
      extensions={[markdown(), EditorView.lineWrapping]}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        bracketMatching: true,
      }}
      className="h-full text-sm"
    />
  );

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/dashboard" })}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-8 max-w-xs flex-1 text-sm"
          placeholder="Diagram title"
        />
        <Select value={type} onValueChange={handleTemplateSwap}>
          <SelectTrigger className="h-8 w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DIAGRAM_TEMPLATES).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saveState === "saving" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </>
            ) : saveState === "saved" ? (
              <>
                <Check className="h-3 w-3 text-primary" />
                Saved
              </>
            ) : (
              <>
                <Save className="h-3 w-3" />
                Auto-save
              </>
            )}
          </div>

          <Button size="sm" variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="mr-1.5 h-4 w-4" />
            AI
          </Button>


          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Download className="mr-1.5 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportSvg}>
                <FileImage className="mr-2 h-4 w-4" />
                SVG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJpg}>
                <FileImage className="mr-2 h-4 w-4" />
                JPG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportMmd}>
                <FileCode2 className="mr-2 h-4 w-4" />
                Mermaid (.mmd)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Workspace */}
      {isMobile ? (
        <Tabs defaultValue="preview" className="flex flex-1 flex-col">
          <TabsList className="mx-3 mt-2 grid w-auto grid-cols-2">
            <TabsTrigger value="preview">
              <FileImage className="mr-1.5 h-4 w-4" />
              Visual
            </TabsTrigger>
            <TabsTrigger value="code">
              <FileText className="mr-1.5 h-4 w-4" />
              Code
            </TabsTrigger>
          </TabsList>
          <TabsContent value="preview" className="flex-1 overflow-hidden">
            <MermaidPreview code={code} onSvg={handleSvgReady} />
          </TabsContent>
          <TabsContent value="code" className="flex-1 overflow-hidden">
            {codeEditor}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="grid flex-1 grid-cols-2 overflow-hidden">
          <div className="flex flex-col border-r border-border">
            <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Visual
            </div>
            <div className="flex-1 overflow-hidden">
              <MermaidPreview code={code} onSvg={handleSvgReady} />
            </div>
          </div>
          <div className="flex flex-col">
            <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Mermaid code
            </div>
            <div className="flex-1 overflow-hidden">{codeEditor}</div>
          </div>
        </div>
      )}

      <AiPromptDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        defaultType={type}
        existingCode={code}
        onGenerated={({ code: newCode, title: newTitle, diagram_type }) => {
          setCode(newCode);
          setType(diagram_type);
          if (!title || title.startsWith("New ") || title === "Untitled diagram") {
            setTitle(newTitle);
          }
          toast.success("Diagram generated");
        }}
      />
    </div>
  );
}
