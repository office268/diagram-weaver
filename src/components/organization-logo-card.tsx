import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, Image as ImageIcon, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import {
  uploadOrganizationLogo,
  removeOrganizationLogo,
} from "@/lib/organizations.functions";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(b64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function OrganizationLogoCard() {
  const { data: org, isLoading } = useCurrentOrganization();
  const qc = useQueryClient();
  const uploadFn = useServerFn(uploadOrganizationLogo);
  const removeFn = useServerFn(removeOrganizationLogo);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const canManage = org && (org.role === "owner" || org.role === "admin");

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      if (!org) throw new Error("ארגון לא נטען");
      if (!ALLOWED.includes(file.type)) throw new Error("פורמט לא נתמך (PNG/JPG/WEBP/SVG)");
      if (file.size > MAX_BYTES) throw new Error("הקובץ גדול מדי (מקס׳ 2MB)");
      const b64 = await fileToBase64(file);
      return uploadFn({
        data: {
          org_id: org.id,
          file_base64: b64,
          content_type: file.type,
          filename: file.name,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["current-organization"] });
      toast.success("הלוגו עודכן");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "העלאה נכשלה"),
    onSettled: () => setBusy(false),
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      if (!org) throw new Error("ארגון לא נטען");
      return removeFn({ data: { org_id: org.id } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["current-organization"] });
      toast.success("הלוגו הוסר");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "הסרה נכשלה"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          לוגו הארגון
        </CardTitle>
        <CardDescription>
          הלוגו יוצג ליד שם הארגון בכותרת המערכת. מומלץ PNG/SVG מרובע על רקע שקוף, עד 2MB.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !org ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
              {org.logo_url ? (
                <img src={org.logo_url} alt={org.name} className="h-full w-full object-contain" />
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="text-sm font-medium text-foreground">{org.name}</div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={inputRef}
                  type="file"
                  accept={ALLOWED.join(",")}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f) return;
                    setBusy(true);
                    uploadMut.mutate(f);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  disabled={!canManage || busy || uploadMut.isPending}
                  onClick={() => inputRef.current?.click()}
                >
                  {busy || uploadMut.isPending ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-4 w-4" />
                  )}
                  העלה לוגו
                </Button>
                {org.logo_url ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    disabled={!canManage || removeMut.isPending}
                    onClick={() => removeMut.mutate()}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    הסר לוגו
                  </Button>
                ) : null}
              </div>
              {!canManage ? (
                <div className="text-xs text-muted-foreground">
                  רק בעלים או מנהל ארגון יכולים לשנות את הלוגו.
                </div>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
