// ============================================================
// src/components/settings/organization-logo-card.tsx
// רכיב UI — organization-logo-card
// ============================================================
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Upload, Trash2, Image as ImageIcon, Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import {
  uploadOrganizationLogo,
  removeOrganizationLogo,
  updateOrganizationDetails,
  type OrgKind,
} from "@/lib/organizations.functions";

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

const ORG_KIND_LABELS: Record<OrgKind, string> = {
  public: "ציבורי",
  nonprofit: "עמותה",
  government: "ממשלתי",
  private: "פרטי",
};

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
  const updateFn = useServerFn(updateOrganizationDetails);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [orgKind, setOrgKind] = useState<OrgKind | "">("");
  const [identifier, setIdentifier] = useState("");

  useEffect(() => {
    if (!org) return;
    setName(org.name ?? "");
    setAddress(org.address ?? "");
    setWebsite(org.website ?? "");
    setOrgKind((org.org_kind ?? "") as OrgKind | "");
    setIdentifier(org.identifier ?? "");
  }, [org?.id, org?.name, org?.address, org?.website, org?.org_kind, org?.identifier]);

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

  const detailsMut = useMutation({
    mutationFn: async () => {
      if (!org) throw new Error("ארגון לא נטען");
      if (!name.trim()) throw new Error("יש להזין שם ארגון");
      const w = website.trim();
      if (w && !/^https?:\/\//i.test(w)) {
        throw new Error("כתובת האתר חייבת להתחיל ב-http:// או https://");
      }
      return updateFn({
        data: {
          org_id: org.id,
          name: name.trim(),
          address: address.trim() || null,
          website: w || null,
          org_kind: (orgKind || null) as OrgKind | null,
          identifier: identifier.trim() || null,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["current-organization"] });
      toast.success("פרטי הארגון עודכנו");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "העדכון נכשל"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          פרטי הארגון
        </CardTitle>
        <CardDescription>
          הלוגו והשם יוצגו בכותרת המערכת. מומלץ PNG/SVG מרובע על רקע שקוף, עד 2MB.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !org ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30">
                {org.logo_url ? (
                  <img src={org.logo_url} alt={org.name} className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 space-y-2">
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
                      <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="ml-1.5 h-4 w-4" />
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
                      <Trash2 className="ml-1.5 h-4 w-4" />
                      הסר לוגו
                    </Button>
                  ) : null}
                </div>
                {!canManage ? (
                  <div className="text-xs text-muted-foreground">
                    רק בעלים או מנהל ארגון יכולים לשנות פרטים אלה.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">שם הארגון</Label>
                <Input
                  id="org-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canManage}
                  placeholder="לדוגמה: עיר דוד"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-identifier">מזהה</Label>
                <Input
                  id="org-identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={!canManage}
                  placeholder="ח.פ / ע.ר / מס׳ פנימי"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="org-address">כתובת</Label>
                <Input
                  id="org-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={!canManage}
                  placeholder="רחוב, מספר, עיר"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-website">אתר אינטרנט</Label>
                <Input
                  id="org-website"
                  type="url"
                  dir="ltr"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  disabled={!canManage}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-kind">סוג הארגון</Label>
                <Select
                  value={orgKind || undefined}
                  onValueChange={(v) => setOrgKind(v as OrgKind)}
                  disabled={!canManage}
                >
                  <SelectTrigger id="org-kind">
                    <SelectValue placeholder="בחר סוג" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ORG_KIND_LABELS) as OrgKind[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {ORG_KIND_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={!canManage || detailsMut.isPending}
                onClick={() => detailsMut.mutate()}
              >
                {detailsMut.isPending ? (
                  <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="ml-1.5 h-4 w-4" />
                )}
                שמור פרטים
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
