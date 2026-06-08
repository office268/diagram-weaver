import { DiagramRenderer } from "@/components/diagram-renderer";

interface Props {
  code: string;
  onChange: (code: string) => void;
}

export function SpecDiagram({ code, onChange }: Props) {
  if (!code.trim()) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          אין תרשים. צור מסמך מחדש כדי לקבל תרשים.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="h-[420px] w-full overflow-hidden">
        <DiagramRenderer
          code={code}
          onSave={async (newCode) => { onChange(newCode); }}
        />
      </div>
    </div>
  );
}
