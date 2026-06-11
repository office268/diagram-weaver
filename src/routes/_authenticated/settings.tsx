// ============================================================
// src/routes/_authenticated/settings.tsx
// מסך מאומת (Authenticated route) — settings.tsx
// דורש משתמש מחובר; יושב תחת layout _authenticated
// ============================================================
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { Card, CardContent } from "@/components/ui/card";
import { AppMetadataCard } from "@/components/app-metadata-card";
import { EditableSiteText } from "@/components/editable-site-text";
import { DocTypeSectionsCard } from "@/components/doc-type-sections-card";
import { DocTypeInstructionsCard } from "@/components/doc-type-instructions-card";
import { BusinessKnowledgeCard } from "@/components/business-knowledge-card";
import { LoginLogCard } from "@/components/login-log-card";
import { useSiteTexts } from "@/lib/site-texts-context";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { RestartTourButton, OnboardingEnabledToggle } from "@/components/onboarding/restart-tour-button";
import { AiUsageCard } from "@/components/ai-usage-card";
import { PromptBoxSettingsCard } from "@/components/prompt-box-settings-card";
import { OrganizationLogoCard } from "@/components/organization-logo-card";
import { AiModelSettingCard } from "@/components/ai-model-setting-card";

import {
  getAiSettings,
  updateBusinessKnowledge,
} from "@/lib/ai/settings.functions";



export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "הגדרות AI — סוכן ניתוח מערכות" },
      { name: "description", content: "עריכת ה-system instruction לכל סוג מסמך." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin } = useSiteTexts();
  const qc = useQueryClient();
  const getSettingsFn = useServerFn(getAiSettings);
  const updateKnowledgeFn = useServerFn(updateBusinessKnowledge);
  const { data: aiSettings, isLoading: aiLoading } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: () => getSettingsFn(),
  });


  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
      <AppBreadcrumb items={[{ label: "פרויקטים", to: "/projects" }, { label: "הגדרות" }]} />

      <div>
        <EditableSiteText
          as="h1"
          textKey="settings.title"
          defaultValue="הגדרות AI"
          className="text-2xl font-semibold tracking-tight text-foreground block"
        />
        <EditableSiteText
          as="p"
          multiline
          textKey="settings.subtitle"
          defaultValue="נהלו את ה-system instruction וצפו במבנה הפרומפט שנשלח ליצירת מסמכי האפיון."
          className="mt-1 text-sm text-muted-foreground block"
        />
      </div>

      <SettingsSection title="סיור מודרך" description="חזרה על המדריך לשימוש במערכת.">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground">
                הפעלה מחדש של הסיור המקוצר על תכונות המערכת.
              </div>
              <RestartTourButton />
            </div>
            <div className="border-t border-border pt-4">
              <OnboardingEnabledToggle />
            </div>
          </CardContent>
        </Card>
      </SettingsSection>

      <SettingsSection
        title="פרטי הארגון"
        description="שם, לוגו, כתובת, אתר, סוג ומזהה הארגון."
      >
        <OrganizationLogoCard />
      </SettingsSection>


      <SettingsSection
        title="ידע ארגוני / עסקי שלי"
        description="ידע שיישלח ל-AI עבור כל מסמך שלך — בכל הפרויקטים."
      >
        <BusinessKnowledgeCard
          label="הידע הארגוני / עסקי שלי"
          description="תיאור של הארגון, התחום, מונחים פנימיים, אילוצים וכל דבר שכדאי שה-AI יכיר ברקע."
          value={aiSettings?.business_knowledge ?? ""}
          isLoading={aiLoading}
          onSave={async (next) => {
            await updateKnowledgeFn({ data: { business_knowledge: next } });
            qc.invalidateQueries({ queryKey: ["ai-settings"] });
          }}
        />
      </SettingsSection>

      <SettingsSection
        title="ניהול תיבת הפרומפט"
        description="גודל התיבה, סוגי העלאות, מצבים מאופשרים ומשפט ברירת מחדל."
      >
        <PromptBoxSettingsCard />
      </SettingsSection>

      <SettingsSection
        title="עלויות"
        description="פירוט מצטבר של כל פעולות ה-AI שלך — מסמכים, מילים, טוקנים ועלות. נשמר גם עבור מסמכים שנמחקו."
      >
        <AiUsageCard />
      </SettingsSection>



      {isAdmin ? (
        <>

          <SettingsSection title="לוג התחברויות" description="כל ניסיונות ההתחברות לאתר.">
            <LoginLogCard />
          </SettingsSection>

          <SettingsSection title="מטא־דאטה של האפליקציה" description="כותרת, תיאור ותגי שיתוף.">
            <AppMetadataCard />
          </SettingsSection>

          <SettingsSection
            title="סוגי מסמכים וסעיפי ברירת מחדל"
            description="ניהול הסעיפים שיופיעו בכל סוג מסמך חדש."
          >
            <DocTypeSectionsCard />
          </SettingsSection>
        </>
      ) : null}

      {isAdmin ? (
        <SettingsSection
          title="מודל AI לסוכנים"
          description="המודל שישמש את כל סוכני יצירת התוצרים. רק מנהל יכול לשנות."
        >
          <AiModelSettingCard />
        </SettingsSection>
      ) : null}

      {isAdmin ? (
        <SettingsSection
          title="הוראות מערכת לפי סוג מסמך"
          description="ה-System Instruction שמופנה למודל לכל סוג מסמך — גלובלי לכל המשתמשים."
        >
          <DocTypeInstructionsCard />
        </SettingsSection>
      ) : null}
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className="rounded-lg border border-border bg-card">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-right hover:bg-muted/40"
          >
            <ChevronRight
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
            />
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">{title}</div>
              {description ? (
                <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
              ) : null}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border p-4">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}
