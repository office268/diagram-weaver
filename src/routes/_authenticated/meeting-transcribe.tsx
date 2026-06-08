import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic, Square, Upload, FileAudio, Trash2, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { createChatThread } from "@/lib/chat.functions";
import { OUTPUT_TYPES } from "@/lib/output-types";

export const Route = createFileRoute("/_authenticated/meeting-transcribe")({
  head: () => ({
    meta: [{ title: "תמלול וסיכום ישיבה" }],
  }),
  component: MeetingTranscribePage,
});

const MAX_BYTES = 100 * 1024 * 1024;

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function MeetingTranscribePage() {
  const navigate = useNavigate();
  const createThreadFn = useServerFn(createChatThread);

  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioName, setAudioName] = useState<string>("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (tickRef.current) window.clearInterval(tickRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try { mediaRecorderRef.current.stop(); } catch { /* noop */ }
      }
    };
  }, [audioUrl]);

  const resetAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioName("");
    setAudioUrl(null);
    setTranscript("");
    setRecordMs(0);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const name = `recording-${ts}.webm`;
        setAudioBlob(blob);
        setAudioName(name);
        setAudioUrl(URL.createObjectURL(blob));
      };
      mediaRecorderRef.current = mr;
      recordStartRef.current = Date.now();
      setRecordMs(0);
      tickRef.current = window.setInterval(() => {
        setRecordMs(Date.now() - recordStartRef.current);
      }, 250);
      mr.start();
      setIsRecording(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "לא ניתן לגשת למיקרופון");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setIsRecording(false);
  };

  const handleFile = useCallback((file: File) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("הקובץ גדול מ-100MB");
      return;
    }
    const mime = file.type || "";
    if (mime && !mime.startsWith("audio/") && !mime.startsWith("video/")) {
      toast.error(`סוג קובץ לא נתמך: ${mime}`);
      return;
    }
    resetAudio();
    setAudioBlob(file);
    setAudioName(file.name);
    setAudioUrl(URL.createObjectURL(file));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const transcribeMut = useMutation({
    mutationFn: async () => {
      if (!audioBlob) throw new Error("אין קובץ אודיו");
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("נדרשת התחברות מחדש");

      const fd = new FormData();
      fd.append("file", audioBlob, audioName || "audio.webm");
      fd.append("language", "heb");

      const res = await fetch("/api/transcribe-audio", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const t = (await res.text().catch(() => "")) || `שגיאה ${res.status}`;
        throw new Error(t);
      }
      return (await res.json()) as {
        formatted: string;
        text: string;
        segments: Array<{ speaker: string; start: number; end: number; text: string }>;
        language: string;
      };
    },
    onSuccess: (data) => {
      setTranscript(data.formatted || data.text || "");
      toast.success("התמלול הושלם");
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "התמלול נכשל");
    },
  });

  const continueMut = useMutation({
    mutationFn: async () => {
      if (!transcript.trim()) throw new Error("התמלול ריק");
      const res = await createThreadFn({
        data: {
          outputType: "meeting_summary",
          title: OUTPUT_TYPES.meeting_summary.label,
        },
      });
      return { threadId: res.thread.id };
    },
    onSuccess: ({ threadId }) => {
      try {
        const prefill = [
          "להלן תמלול הישיבה (כולל זיהוי דוברים וחותמות זמן). אנא צור סיכום מובנה הכולל: נושאים שנדונו, החלטות, משימות (משימה, אחראי, תאריך יעד), ונקודות מפתח.",
          "",
          "—— תמלול ——",
          transcript.trim(),
        ].join("\n");
        sessionStorage.setItem(`chat-prefill:${threadId}`, prefill);
      } catch { /* sessionStorage may be unavailable */ }
      navigate({ to: "/chat/$threadId", params: { threadId } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "יצירת שיחה נכשלה"),
  });

  const t = OUTPUT_TYPES.meeting_summary;
  const Icon = t.icon;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 gap-1"
        onClick={() => navigate({ to: "/dashboard" })}
      >
        <ArrowLeft className="h-4 w-4" />
        חזרה
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`rounded-lg bg-muted p-2 ${t.colorClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>{t.label}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: pick source */}
          {!audioBlob && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">שלב 1 — מקור האודיו</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className="group flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card p-6 hover:border-primary hover:bg-accent transition"
                >
                  {isRecording ? (
                    <>
                      <Square className="h-8 w-8 text-destructive animate-pulse" />
                      <span className="font-medium">עצור הקלטה</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatDuration(recordMs)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-8 w-8 text-primary" />
                      <span className="font-medium">הקלט עכשיו</span>
                      <span className="text-xs text-muted-foreground">
                        הקלטה ישירות מהדפדפן
                      </span>
                    </>
                  )}
                </button>

                <label className="group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card p-6 hover:border-primary hover:bg-accent transition">
                  <Upload className="h-8 w-8 text-primary" />
                  <span className="font-medium">העלה קובץ אודיו</span>
                  <span className="text-xs text-muted-foreground">
                    mp3 / m4a / wav / webm · עד 100MB
                  </span>
                  <input
                    type="file"
                    accept="audio/*,video/webm"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                  onClick={async () => {
                    try {
                      const res = await createThreadFn({
                        data: {
                          outputType: "meeting_summary",
                          title: OUTPUT_TYPES.meeting_summary.label,
                        },
                      });
                      navigate({
                        to: "/chat/$threadId",
                        params: { threadId: res.thread.id },
                      });
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "יצירה נכשלה");
                    }
                  }}
                >
                  דלג — יש לי כבר תמלול טקסט
                </button>
              </div>
            </div>
          )}

          {/* Step 2: preview + transcribe */}
          {audioBlob && !transcript && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">שלב 2 — תמלול</Label>
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <FileAudio className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{audioName}</div>
                  {audioUrl && (
                    <audio src={audioUrl} controls className="mt-2 w-full" />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={resetAudio}
                  disabled={transcribeMut.isPending}
                  aria-label="הסר"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <Button
                onClick={() => transcribeMut.mutate()}
                disabled={transcribeMut.isPending}
                className="w-full gap-2"
                size="lg"
              >
                {transcribeMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    מתמלל... (~דקה לכל 10 ד&apos; אודיו)
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    תמלל ושלח לסיכום
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 3: edit transcript + continue */}
          {transcript && (
            <div className="space-y-3">
              <Label htmlFor="transcript" className="text-sm font-medium">
                שלב 3 — תמלול גולמי (ניתן לעריכה)
              </Label>
              <Textarea
                id="transcript"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={14}
                dir="rtl"
                className="font-mono text-sm leading-relaxed"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => continueMut.mutate()}
                  disabled={continueMut.isPending || !transcript.trim()}
                  className="gap-2"
                  size="lg"
                >
                  {continueMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  המשך לסיכום
                </Button>
                <Button
                  variant="outline"
                  onClick={resetAudio}
                  disabled={continueMut.isPending}
                >
                  התחל מחדש
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
