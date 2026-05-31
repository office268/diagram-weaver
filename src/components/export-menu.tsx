import { Download, FileText, FileType2, Printer, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  copyMarkdown,
  downloadDocx,
  downloadMarkdown,
  printAsPdf,
} from "@/lib/spec-export";
import type { SpecContent } from "@/lib/spec-schema";

interface Props {
  title: string;
  content: SpecContent;
  userPrompt: string;
  userNotes: string;
  sectionOrder: string[];
  sectionTitles: Record<string, string>;
  reviewScore?: number | null;
}

export function ExportMenu(props: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2"
          title="ייצוא המסמך"
          aria-label="ייצוא"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">ייצוא</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>הורדה</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => {
            const ok = printAsPdf(props);
            if (!ok) toast.error("חסום על ידי הדפדפן — אפשרו חלונות קופצים");
          }}
        >
          <Printer className="ml-2 h-4 w-4" /> PDF (הדפסה / שמירה)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadMarkdown(props)}>
          <FileText className="ml-2 h-4 w-4" /> Markdown (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => downloadDocx(props)}>
          <FileType2 className="ml-2 h-4 w-4" /> Word (.doc)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            const ok = await copyMarkdown(props);
            if (ok) toast.success("הועתק כ-Markdown");
            else toast.error("העתקה נכשלה");
          }}
        >
          <Copy className="ml-2 h-4 w-4" /> העתק Markdown
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
