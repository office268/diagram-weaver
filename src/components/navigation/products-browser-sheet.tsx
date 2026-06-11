// ============================================================
// src/components/navigation/products-browser-sheet.tsx
// רכיב UI — products-browser-sheet
// ============================================================
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Package,
  Folder,
  FileText,
  ChevronRight,
  ArrowRight,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import {
  listProducts,
  getProduct,
  createProduct,
  listProductProjectSpecs,
} from "@/lib/projects/products.functions";

type Level = "products" | "projects" | "items";

type SelectedProduct = { id: string; name: string };
type SelectedProject = { id: string; name: string };

export function ProductsBrowserSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [level, setLevel] = useState<Level>("products");
  const [product, setProduct] = useState<SelectedProduct | null>(null);
  const [project, setProject] = useState<SelectedProject | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: org } = useCurrentOrganization();
  const canEdit = org?.role === "owner" || org?.role === "admin";

  const fetchProducts = useServerFn(listProducts);
  const fetchProduct = useServerFn(getProduct);
  const fetchSpecs = useServerFn(listProductProjectSpecs);

  const productsQ = useQuery({
    queryKey: ["products", org?.id ?? null],
    queryFn: () => fetchProducts({ data: { orgId: org!.id } }),
    enabled: !!org && open,
  });

  const productQ = useQuery({
    queryKey: ["product", product?.id ?? null],
    queryFn: () => fetchProduct({ data: { id: product!.id } }),
    enabled: !!product && open,
  });

  const specsQ = useQuery({
    queryKey: ["product-project-specs", project?.id ?? null],
    queryFn: () => fetchSpecs({ data: { projectId: project!.id } }),
    enabled: !!project && open,
  });

  const reset = () => {
    setLevel("products");
    setProduct(null);
    setProject(null);
  };

  const goBack = () => {
    if (level === "items") {
      setProject(null);
      setLevel("projects");
    } else if (level === "projects") {
      setProduct(null);
      setLevel("products");
    }
  };

  const handleNavigate = () => {
    onOpenChange(false);
    reset();
  };

  const title =
    level === "products"
      ? "מוצרים"
      : level === "projects"
        ? product?.name ?? "פרויקטים"
        : project?.name ?? "מסמכים ותרשימים";

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(v) => {
          onOpenChange(v);
          if (!v) reset();
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col [direction:rtl]"
        >
          <SheetHeader>
            <div className="flex items-center gap-2">
              {level !== "products" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={goBack}
                  aria-label="חזרה"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              <SheetTitle className="text-right flex-1 truncate">
                {title}
              </SheetTitle>
            </div>
          </SheetHeader>

          <div className="mt-4 flex-1 overflow-y-auto">
            {level === "products" && (
              <ProductsList
                isLoading={productsQ.isLoading}
                products={productsQ.data?.products ?? []}
                canEdit={!!canEdit}
                onCreate={() => setCreateOpen(true)}
                onSelect={(p) => {
                  setProduct({ id: p.id, name: p.name });
                  setLevel("projects");
                }}
              />
            )}

            {level === "projects" && (
              <ProjectsList
                isLoading={productQ.isLoading}
                projects={productQ.data?.projects ?? []}
                onSelect={(p) => {
                  setProject({ id: p.id, name: p.name });
                  setLevel("items");
                }}
              />
            )}

            {level === "items" && (
              <ItemsList
                isLoading={specsQ.isLoading}
                specs={specsQ.data?.specs ?? []}
                onNavigate={handleNavigate}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {createOpen && org && (
        <CreateProductDialog
          orgId={org.id}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="px-3 py-10 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-10">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );
}

function Row({
  icon,
  title,
  subtitle,
  onClick,
  asLink,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick?: () => void;
  asLink?: React.ReactElement;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-3 py-3 hover:bg-accent rounded-md transition-colors w-full text-right">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground rotate-180" />
    </div>
  );
  if (asLink) return asLink;
  return (
    <button onClick={onClick} className="block w-full">
      {inner}
    </button>
  );
}

function ProductsList({
  isLoading,
  products,
  canEdit,
  onCreate,
  onSelect,
}: {
  isLoading: boolean;
  products: Array<{
    id: string;
    name: string;
    description: string;
    project_count: number;
  }>;
  canEdit: boolean;
  onCreate: () => void;
  onSelect: (p: { id: string; name: string }) => void;
}) {
  return (
    <div className="space-y-2">
      {canEdit && (
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onCreate}
        >
          <Plus className="h-4 w-4" />
          מוצר חדש
        </Button>
      )}
      {isLoading ? (
        <LoadingRow />
      ) : products.length === 0 ? (
        <EmptyRow text="אין עדיין מוצרים בארגון" />
      ) : (
        <div className="space-y-1">
          {products.map((p) => (
            <Row
              key={p.id}
              icon={<Package className="h-4 w-4" />}
              title={p.name}
              subtitle={`${p.project_count} פרויקטים`}
              onClick={() => onSelect({ id: p.id, name: p.name })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectsList({
  isLoading,
  projects,
  onSelect,
}: {
  isLoading: boolean;
  projects: Array<{ id: string; name: string; description: string | null }>;
  onSelect: (p: { id: string; name: string }) => void;
}) {
  if (isLoading) return <LoadingRow />;
  if (projects.length === 0)
    return <EmptyRow text="אין פרויקטים המשויכים למוצר זה" />;
  return (
    <div className="space-y-1">
      {projects.map((p) => (
        <Row
          key={p.id}
          icon={<Folder className="h-4 w-4" />}
          title={p.name}
          subtitle={p.description || undefined}
          onClick={() => onSelect({ id: p.id, name: p.name })}
        />
      ))}
    </div>
  );
}

const DOC_TYPE_LABEL: Record<string, string> = {
  spec_overview: "מסמך אפיון",
  diagram: "תרשים",
};

function ItemsList({
  isLoading,
  specs,
  onNavigate,
}: {
  isLoading: boolean;
  specs: Array<{ id: string; title: string; doc_type: string }>;
  onNavigate: () => void;
}) {
  if (isLoading) return <LoadingRow />;
  if (specs.length === 0)
    return <EmptyRow text="אין מסמכים או תרשימים בפרויקט זה" />;
  return (
    <div className="space-y-1">
      {specs.map((s) => (
        <Link
          key={s.id}
          to="/editor/$id"
          params={{ id: s.id }}
          onClick={onNavigate}
          className="block"
        >
          <div className="flex items-center gap-3 px-3 py-3 hover:bg-accent rounded-md transition-colors text-right">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-foreground">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">
                {s.title}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {DOC_TYPE_LABEL[s.doc_type] ?? s.doc_type}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function CreateProductDialog({
  orgId,
  onClose,
}: {
  orgId: string;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useServerFn(createProduct);
  const queryClient = useQueryClient();
  const m = useMutation({
    mutationFn: create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", orgId] });
      toast.success("המוצר נוצר");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="[direction:rtl]">
        <DialogHeader>
          <DialogTitle className="text-right">מוצר חדש</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="שם המוצר"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Textarea
            placeholder="תיאור (אופציונלי)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button
            onClick={() =>
              m.mutate({ data: { orgId, name: name.trim(), description } })
            }
            disabled={!name.trim() || m.isPending}
          >
            {m.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            צור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
