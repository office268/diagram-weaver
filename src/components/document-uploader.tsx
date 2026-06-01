import { useCallback, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Loader2, Trash2, Upload, FilePlus2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  listDocuments,
  deleteDocument,
} from "@/lib/documents.functions";
import {
  describeMime,
  extractTextFromFile,
} from "@/lib/rag/text-extractor.client";

interface Props {
  projectId: string;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TEXT_CHARS = 1_800_000;

export function DocumentUploader({ projectId }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listDocuments);
  const deleteFn = useServerFn(deleteDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyFile, setBusyFile] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["uploaded-documents", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("המסמך נמחק");
      qc.invalidateQueries({ queryKey: ["uploaded-documents", projectId] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "מחיקת המסמך נכשלה"),
  });

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      for (const file of arr) {
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name}: הקובץ גדול מ-15MB`);
          continue;
        }
        setBusyFile(file.name);
        try {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess.session?.access_token;
          if (!token) throw new Error("נדרשת התחברות מחדש");

          const { text, charCount } = await extractTextFromFile(file);
          if (!charCount) throw new Error("לא חולץ טקסט מהקובץ");
          const trimmed =
            charCount > MAX_TEXT_CHARS ? text.slice(0, MAX_TEXT_CHARS) : text;

          const res = await fetch("/api/ingest-document", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: describeMime(file),
              fileSize: file.size,
              text: trimmed,
              projectId,
            }),
          });
          if (!res.ok) {
            const t = (await res.text().catch(() => "")) || `שגיאה ${res.status}`;
            throw new Error(t);
          }
          const json = (await res.json()) as { chunkCount: number };
          toast.success(
            `${file.name}: נטען (${json.chunkCount} קטעים)`,
          );
        } catch (e) {
          toast.error(
            `${file.name}: ${e instanceof Error ? e.message : "ההעלאה נכשלה"}`,
          );
        } finally {
          setBusyFile(null);
        }
      }
      qc.invalidateQueries({ queryKey: ["uploaded-documents", projectId] });
    },
    [projectId, qc],
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          מסמכי הקשר (RAG)
        </CardTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={!!busyFile}
        >
          {busyFile ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin ml-1" />
              {busyFile.slice(0, 18)}…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 ml-1" />
              העלאת מסמך
            </>
          )}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.docx,application/pdf,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          העלה PDF / DOCX / TXT — הסוכן ישתמש בהם כהקשר אוטומטית בעת יצירת
          המסמכים בפרויקט הזה.
        </p>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            טוען מסמכים…
          </div>
        ) : !data?.documents.length ? (
          <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground py-4">
            <FilePlus2 className="h-5 w-5" />
            אין מסמכים מועלים. גרור קובץ או לחץ "העלאת מסמך".
          </div>
        ) : (
          <ul className="space-y-1">
            {data.documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium" title={d.file_name}>
                    {d.file_name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {d.chunk_count} קטעים
                    </Badge>
                    <span>{Math.max(1, Math.round(d.file_size / 1024))} KB</span>
                    {d.status !== "ready" && (
                      <Badge variant="secondary" className="text-[10px]">
                        {d.status}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={removeMutation.isPending}
                  onClick={() => removeMutation.mutate(d.id)}
                  title="מחיקה"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
