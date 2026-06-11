// ============================================================
// src/components/agent-config-card.tsx
// רכיב UI — agent-config-card
// ============================================================
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Bot, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentConfig } from "@/lib/agents-config.functions";

export function AgentConfigCard({ agent }: { agent: AgentConfig }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="pb-0">
          <CollapsibleTrigger asChild>
            <button className="w-full text-start cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-base font-semibold text-foreground">{agent.name}</div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                        open && "rotate-180"
                      )}
                    />
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{agent.role}</div>
                  <p className="mt-2 text-sm text-foreground/90">{agent.description}</p>
                </div>
              </div>
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Meta label="מודל">
                <code className="font-mono text-xs">{agent.model}</code>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {agent.modelSource === "global-override"
                    ? "override גלובלי (admin)"
                    : "ברירת מחדל"}
                </div>
              </Meta>
              <Meta label="Temperature">
                <code className="font-mono text-xs">{agent.temperature}</code>
              </Meta>
              <Meta label="Max output tokens">
                <code className="font-mono text-xs">{agent.maxOutputTokens}</code>
              </Meta>
              <Meta label="בלולאת שיפור">
                <Badge variant={agent.inLoop ? "default" : "secondary"}>
                  {agent.inLoop ? "כן" : "לא"}
                </Badge>
              </Meta>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground/80">
              <span className="font-semibold">מיקום בצנרת: </span>
              {agent.pipelineStage}
            </div>

            {agent.reviewMeta ? (
              <div className="grid grid-cols-2 gap-3">
                <Meta label="סף ציון להפסקת הלולאה">
                  <code className="font-mono text-xs">{agent.reviewMeta.scoreThreshold}/10</code>
                </Meta>
                <Meta label="מקס׳ iterations">
                  <code className="font-mono text-xs">{agent.reviewMeta.maxIterations}</code>
                </Meta>
              </div>
            ) : null}

            <Accordion type="multiple" className="w-full">
              <AccordionItem value="system">
                <AccordionTrigger className="text-sm">System Prompt</AccordionTrigger>
                <AccordionContent>
                  <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap" dir="rtl">
                    {agent.systemPrompt}
                  </pre>
                </AccordionContent>
              </AccordionItem>

              {agent.sharedBlocks.length > 0 ? (
                <AccordionItem value="shared">
                  <AccordionTrigger className="text-sm">
                    בלוקים משותפים מוטמעים ({agent.sharedBlocks.length})
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {agent.sharedBlocks.map((b) => (
                      <div key={b.name}>
                        <div className="mb-1 text-xs font-semibold text-muted-foreground">
                          {b.name}
                        </div>
                        <pre className="max-h-60 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap" dir="rtl">
                          {b.content}
                        </pre>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ) : null}

              <AccordionItem value="template">
                <AccordionTrigger className="text-sm">
                  מבנה הפרומפט (User prompt)
                </AccordionTrigger>
                <AccordionContent>
                  <ol className="list-decimal space-y-1 pr-5 text-sm text-foreground/90">
                    {agent.promptTemplate.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ol>
                </AccordionContent>
              </AccordionItem>

              {agent.loopKeywords && agent.loopKeywords.length > 0 ? (
                <AccordionItem value="loop">
                  <AccordionTrigger className="text-sm">
                    מפעילי לולאת שיפור
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap gap-1.5">
                      {agent.loopKeywords.map((k) => (
                        <Badge key={k} variant="outline" className="text-xs">
                          {k}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      הסוכן מופעל מחדש אם הערות המבקר מכילות אחת ממילות המפתח הללו.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ) : null}
            </Accordion>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
