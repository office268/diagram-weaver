import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, MapPin, Globe, Hash, Loader2, Pencil } from "lucide-react";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/organization")({
  component: OrganizationHomePage,
});

const ORG_KIND_LABELS: Record<string, string> = {
  public: "ציבורי",
  nonprofit: "מלכ\"ר",
  government: "ממשלתי",
  private: "פרטי",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  admin: "מנהל",
  member: "חבר",
};

function OrganizationHomePage() {
  const { data: org, isLoading } = useCurrentOrganization();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center [direction:rtl]">
        <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-semibold">אינך משויך לארגון</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          פנה למנהל המערכת כדי שיצרף אותך לארגון.
        </p>
      </div>
    );
  }

  const canEdit = org.role === "owner" || org.role === "admin";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 [direction:rtl]">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
              {org.logo_url ? (
                <img src={org.logo_url} alt={org.name} className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-2xl">{org.name}</CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{ROLE_LABELS[org.role] ?? org.role}</Badge>
                {org.org_kind && (
                  <Badge variant="outline">{ORG_KIND_LABELS[org.org_kind] ?? org.org_kind}</Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DetailRow icon={<Hash className="h-4 w-4" />} label="מזהה" value={org.identifier} />
          <DetailRow icon={<MapPin className="h-4 w-4" />} label="כתובת" value={org.address} />
          <DetailRow
            icon={<Globe className="h-4 w-4" />}
            label="אתר אינטרנט"
            value={
              org.website ? (
                <a
                  href={org.website.startsWith("http") ? org.website : `https://${org.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {org.website}
                </a>
              ) : null
            }
          />

          {canEdit && (
            <div className="pt-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/settings">
                  <Pencil className="ml-2 h-4 w-4" />
                  ערוך פרטי ארגון
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-sm">{value || <span className="text-muted-foreground">—</span>}</div>
      </div>
    </div>
  );
}
