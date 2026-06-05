import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Shapes } from "lucide-react";
import {
  getDashboardTileOrder,
  setDashboardTileOrder,
} from "@/lib/dashboard-tile-order.functions";
import { useSiteTexts } from "@/lib/site-texts-context";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  OUTPUT_TYPES,
  OUTPUT_TYPE_ORDER,
  OUTPUT_TYPE_EXTRAS,
  type OutputKey,
} from "@/lib/output-types";
import { createChatThread } from "@/lib/chat.functions";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "סוכן ניתוח מערכות — בית" },
      { name: "description", content: "בחר/י סוג מסמך או תרשים ליצירה." },
    ],
  }),
  component: HomePage,
});

const STORAGE_PREFIX = "dashboard-tile-order:";

function loadOrder(userId: string | undefined): OutputKey[] {
  const defaults = [...OUTPUT_TYPE_ORDER];
  if (!userId || typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return defaults;
    const saved = JSON.parse(raw) as string[];
    const valid = saved.filter((k): k is OutputKey =>
      (OUTPUT_TYPE_ORDER as readonly string[]).includes(k),
    );
    // merge any new keys not present in saved order at the end
    const missing = defaults.filter((k) => !valid.includes(k));
    return [...valid, ...missing];
  } catch {
    return defaults;
  }
}

function saveOrder(userId: string | undefined, order: OutputKey[]) {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(order));
  } catch {
    // ignore
  }
}

function HomePage() {
  const navigate = useNavigate();
  const { isAdmin } = useSiteTexts();
  const qc = useQueryClient();
  const createFn = useServerFn(createChatThread);
  const getOrderFn = useServerFn(getDashboardTileOrder);
  const setOrderFn = useServerFn(setDashboardTileOrder);

  const { data: orderData } = useQuery({
    queryKey: ["dashboard-tile-order"],
    queryFn: () => getOrderFn(),
  });

  const [order, setOrder] = useState<OutputKey[]>(() => [...OUTPUT_TYPE_ORDER]);

  useEffect(() => {
    if (orderData?.order) setOrder(orderData.order);
  }, [orderData]);

  const saveMut = useMutation({
    mutationFn: (next: OutputKey[]) => setOrderFn({ data: { order: next } }),
    onMutate: (next) => {
      const previous = order;
      setOrder(next);
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      toast.error(e instanceof Error ? e.message : "שמירת סדר נכשלה");
      if (ctx?.previous) setOrder(ctx.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-tile-order"] });
    },
  });

  const createMut = useMutation({
    mutationFn: (outputType: OutputKey) =>
      createFn({ data: { outputType, title: OUTPUT_TYPES[outputType].label } }),
    onSuccess: (res) => {
      navigate({ to: "/chat/$threadId", params: { threadId: res.thread.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "יצירה נכשלה"),
  });

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 12 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!isAdmin) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = order.indexOf(active.id as OutputKey);
    const newIndex = order.indexOf(over.id as OutputKey);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    saveMut.mutate(next);
  };

  const items = useMemo(() => order, [order]);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-4 pt-4 min-h-[calc(100dvh-9rem)]">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={rectSortingStrategy}>
          <div className="grid flex-1 auto-rows-min content-evenly grid-cols-3 gap-x-3 gap-y-3 sm:gap-x-4 sm:gap-y-4 lg:gap-5">
            {items.map((key, i) => (
              <SortableTile
                key={key}
                outputKey={key}
                index={i}
                pending={createMut.isPending && createMut.variables === key}
                disabled={createMut.isPending}
                draggable={isAdmin}
                onActivate={() => createMut.mutate(key)}
              />
            ))}
            <MoreTile
              index={items.length}
              disabled={createMut.isPending}
              onActivate={() => setMoreOpen(true)}
            />
          </div>
        </SortableContext>
      </DndContext>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent>
          <DrawerHeader className="text-right">
            <DrawerTitle>סוגי מסמכים נוספים</DrawerTitle>
            <DrawerDescription>בחר/י סוג מסמך או תרשים פחות נפוץ ליצירה.</DrawerDescription>
          </DrawerHeader>
          <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-3 px-4 pb-6 sm:grid-cols-3">
            {OUTPUT_TYPE_EXTRAS.map((key) => {
              const t = OUTPUT_TYPES[key];
              const Icon = t.icon;
              const isPending = createMut.isPending && createMut.variables === key;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={createMut.isPending}
                  onClick={() => {
                    setMoreOpen(false);
                    createMut.mutate(key);
                  }}
                  className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-gradient-to-br from-card to-accent/30 p-3 text-center transition-colors hover:bg-accent/40 disabled:opacity-50"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent ${t.colorClass}`}
                  >
                    {isPending ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      <Icon className="h-6 w-6" />
                    )}
                  </div>
                  <div className="text-xs font-semibold leading-tight text-foreground">
                    {t.label}
                  </div>
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function MoreTile({
  index,
  disabled,
  onActivate,
}: {
  index: number;
  disabled: boolean;
  onActivate: () => void;
}) {
  const style: React.CSSProperties = {
    animationDelay: `${index * 30}ms`,
    animationFillMode: "backwards",
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onActivate}
      style={style}
      className="cube-3d animate-fade-in group relative flex h-28 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed border-border/70 bg-gradient-to-br from-card to-accent/20 p-3 text-center sm:h-36 sm:gap-3 sm:p-4 disabled:opacity-50"
    >
      <span
        className="absolute top-2 end-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent ring-1 ring-border/60 text-primary"
        aria-label="AI"
        title="AI"
      >
        <Sparkles className="h-3 w-3" />
      </span>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent text-primary sm:h-14 sm:w-14">
        <Shapes className="h-5 w-5 sm:h-7 sm:w-7" />
      </div>
      <div className="min-w-0 px-1">
        <div className="line-clamp-2 text-[11px] font-semibold leading-tight text-foreground sm:text-sm">
          עוד…
        </div>
        <p className="mt-1 hidden text-xs text-muted-foreground sm:block">
          סוגי מסמכים ותרשימים נוספים
        </p>
      </div>
    </button>
  );
}

function SortableTile({
  outputKey,
  index,
  pending,
  disabled,
  onActivate,
}: {
  outputKey: OutputKey;
  index: number;
  pending: boolean;
  disabled: boolean;
  onActivate: () => void;
}) {
  const t = OUTPUT_TYPES[outputKey];
  const Icon = t.icon;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: outputKey,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    animationDelay: `${index * 30}ms`,
    animationFillMode: "backwards",
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : undefined,
    touchAction: "none",
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={disabled}
      onClick={onActivate}
      style={style}
      {...attributes}
      {...listeners}
      className={`cube-3d animate-fade-in group relative flex h-28 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card to-accent/30 p-3 text-center sm:h-36 sm:gap-3 sm:p-4 disabled:opacity-50 ${
        isDragging ? "shadow-lg ring-2 ring-primary/40" : ""
      }`}
    >
      <span
        className={`absolute top-2 end-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent ring-1 ring-border/60 ${t.colorClass}`}
        aria-label="AI"
        title="AI"
      >
        <Sparkles className="h-3 w-3" />
      </span>
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent sm:h-14 sm:w-14 ${t.colorClass}`}
      >
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin sm:h-7 sm:w-7" />
        ) : (
          <Icon className="h-5 w-5 sm:h-7 sm:w-7" />
        )}
      </div>
      <div className="min-w-0 px-1">
        <div className="line-clamp-2 text-[11px] font-semibold leading-tight text-foreground sm:text-sm">
          {t.label}
        </div>
        <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{t.description}</p>
      </div>
    </button>
  );
}
