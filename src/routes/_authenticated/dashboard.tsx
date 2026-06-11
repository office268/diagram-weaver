// ============================================================
// src/routes/_authenticated/dashboard.tsx
// מסך מאומת (Authenticated route) — dashboard.tsx
// דורש משתמש מחובר; יושב תחת layout _authenticated
// ============================================================
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, MoreHorizontal, Shapes, FileText, Wrench } from "lucide-react";
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
  isDiagramType,
  type OutputKey,
} from "@/lib/doc-types/output-types";
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

  const order = useMemo<OutputKey[]>(
    () => (orderData?.order as OutputKey[] | undefined) ?? [...OUTPUT_TYPE_ORDER],
    [orderData],
  );
  const movedToExtras = useMemo<OutputKey[]>(
    () => ((orderData as any)?.movedToExtras as OutputKey[] | undefined) ?? [],
    [orderData],
  );
  const movedToMain = useMemo<OutputKey[]>(
    () => ((orderData as any)?.movedToMain as OutputKey[] | undefined) ?? [],
    [orderData],
  );

  const movedToExtrasSet = useMemo(() => new Set(movedToExtras), [movedToExtras]);
  const movedToMainSet   = useMemo(() => new Set(movedToMain),   [movedToMain]);

  const mainTiles = useMemo(
    () => [
      ...order.filter((k) => !movedToExtrasSet.has(k)),
      ...movedToMain,
    ],
    [order, movedToExtrasSet, movedToMain],
  );

  const extrasTiles = useMemo(
    () => [
      ...OUTPUT_TYPE_EXTRAS.filter((k) => !movedToMainSet.has(k)),
      ...movedToExtras,
    ],
    [movedToExtras, movedToMainSet],
  );

  type TileOrderPayload = {
    order: OutputKey[];
    movedToExtras: OutputKey[];
    movedToMain: OutputKey[];
  };

  const saveMut = useMutation({
    mutationFn: (input: Partial<TileOrderPayload>) => setOrderFn({ data: input }),
    onMutate: (input) => {
      const previous = qc.getQueryData<TileOrderPayload>(["dashboard-tile-order"]);
      qc.setQueryData<TileOrderPayload>(["dashboard-tile-order"], {
        order: input.order ?? previous?.order ?? order,
        movedToExtras: input.movedToExtras ?? previous?.movedToExtras ?? movedToExtras,
        movedToMain: input.movedToMain ?? previous?.movedToMain ?? movedToMain,
      });
      return { previous };
    },
    onError: (e, _vars, ctx) => {
      toast.error(e instanceof Error ? e.message : "שמירת סדר נכשלה");
      if (ctx?.previous) qc.setQueryData(["dashboard-tile-order"], ctx.previous);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-tile-order"] });
    },
  });

  const moveToExtras = (key: OutputKey) => {
    if (!isAdmin) {
      toast.error("רק מנהל מערכת יכול להעביר קוביות");
      return;
    }
    if ((OUTPUT_TYPE_ORDER as readonly string[]).includes(key)) {
      const next = movedToExtras.includes(key) ? movedToExtras : [...movedToExtras, key];
      saveMut.mutate({ movedToExtras: next });
    } else {
      const next = movedToMain.filter((k) => k !== key);
      saveMut.mutate({ movedToMain: next });
    }
    toast.success(`"${OUTPUT_TYPES[key].label}" הועבר ל'עוד'`);
  };

  const moveToMain = (key: OutputKey) => {
    if (!isAdmin) {
      toast.error("רק מנהל מערכת יכול להעביר קוביות");
      return;
    }
    if ((OUTPUT_TYPE_EXTRAS as readonly string[]).includes(key)) {
      const next = movedToMain.includes(key) ? movedToMain : [...movedToMain, key];
      saveMut.mutate({ movedToMain: next });
    } else {
      const next = movedToExtras.filter((k) => k !== key);
      saveMut.mutate({ movedToExtras: next });
    }
    toast.success(`"${OUTPUT_TYPES[key].label}" הועבר למסך הראשי`);
  };


  const createMut = useMutation({
    mutationFn: (outputType: OutputKey) =>
      createFn({ data: { outputType, title: OUTPUT_TYPES[outputType].label } }),
    onSuccess: (res) => {
      navigate({ to: "/chat/$threadId", params: { threadId: res.thread.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "יצירה נכשלה"),
  });

  const activateTile = (key: OutputKey) => {
    if (key === "meeting_summary") {
      navigate({ to: "/meeting-transcribe" });
      return;
    }
    if (key === "user_story" || key === "dashboard") {
      return;
    }
    createMut.mutate(key);
  };



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
    const activeKey = active.id as OutputKey;
    const overKey = over.id as OutputKey;
    const sameGroup = isDiagramType(activeKey) === isDiagramType(overKey);
    if (!sameGroup) return;
    const oldIndex = mainTiles.indexOf(activeKey);
    const newIndex = mainTiles.indexOf(overKey);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(mainTiles, oldIndex, newIndex);
    const next = reordered.filter((k) => (OUTPUT_TYPE_ORDER as readonly string[]).includes(k));
    saveMut.mutate({ order: next });
  };
  const [moreGroup, setMoreGroup] = useState<null | "diagram" | "document">(null);

  const diagramTiles = useMemo(() => mainTiles.filter((k) => isDiagramType(k)), [mainTiles]);
  const documentTiles = useMemo(
    () => mainTiles.filter((k) => !isDiagramType(k) && k !== "meeting_summary" && k !== "dashboard"),
    [mainTiles],
  );
  const toolTiles = useMemo(
    () => mainTiles.filter((k) => k === "meeting_summary" || k === "dashboard"),
    [mainTiles],
  );


  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-4 pt-4 min-h-[calc(100dvh-9rem)]">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:gap-5 items-start">
          {diagramTiles.length > 0 && (
            <section>
              <SectionHeading label="UML" variant="uml" />
              <SortableContext items={diagramTiles} strategy={rectSortingStrategy}>
                <div className="grid auto-rows-min grid-cols-1 gap-y-3 sm:gap-y-4 lg:gap-5">

                  {diagramTiles.map((key, i) => (
                    <SortableTile
                      key={key}
                      outputKey={key}
                      index={i}
                      pending={(createMut.isPending && createMut.variables === key)}
                      disabled={createMut.isPending}
                      draggable={isAdmin && (OUTPUT_TYPE_ORDER as readonly string[]).includes(key)}
                      onActivate={() => activateTile(key)}
                      onMoveToExtras={() => moveToExtras(key)}
                    />
                  ))}
                  <MoreTile
                    index={diagramTiles.length}
                    disabled={createMut.isPending}
                    onActivate={() => setMoreGroup("diagram")}
                  />
                </div>
              </SortableContext>
            </section>
          )}

          <section>
            <SectionHeading label="PRDocs" variant="docs" />
            <SortableContext items={documentTiles} strategy={rectSortingStrategy}>
              <div className="grid auto-rows-min grid-cols-1 gap-y-3 sm:gap-y-4 lg:gap-5">
                {documentTiles.map((key, i) => (
                  <SortableTile
                    key={key}
                    outputKey={key}
                    index={i}
                    pending={(createMut.isPending && createMut.variables === key)}
                    disabled={createMut.isPending}
                    draggable={isAdmin && (OUTPUT_TYPE_ORDER as readonly string[]).includes(key)}
                    onActivate={() => activateTile(key)}
                    onMoveToExtras={() => moveToExtras(key)}
                  />
                ))}
                <MoreTile
                  index={documentTiles.length}
                  disabled={createMut.isPending}
                  onActivate={() => setMoreGroup("document")}
                />
              </div>
            </SortableContext>
          </section>

          {toolTiles.length > 0 && (
            <section>
              <SectionHeading label="Tools" variant="tools" />
              <SortableContext items={toolTiles} strategy={rectSortingStrategy}>
                <div className="grid auto-rows-min grid-cols-1 gap-y-3 sm:gap-y-4 lg:gap-5">
                  {toolTiles.map((key, i) => (
                    <SortableTile
                      key={key}
                      outputKey={key}
                      index={i}
                      pending={(createMut.isPending && createMut.variables === key)}
                      disabled={createMut.isPending}
                      draggable={false}
                      onActivate={() => activateTile(key)}
                      onMoveToExtras={() => moveToExtras(key)}
                    />
                  ))}
                </div>
              </SortableContext>
            </section>
          )}

        </div>
      </DndContext>

      <Drawer open={moreGroup !== null} onOpenChange={(o) => !o && setMoreGroup(null)}>
        <DrawerContent>
          <DrawerHeader className="text-right">
            <DrawerTitle>
              {moreGroup === "diagram" ? "תרשימים נוספים" : "מסמכים נוספים"}
            </DrawerTitle>
            <DrawerDescription>
              {moreGroup === "diagram"
                ? "בחר/י סוג תרשים פחות נפוץ ליצירה."
                : "בחר/י סוג מסמך פחות נפוץ ליצירה."}
            </DrawerDescription>
          </DrawerHeader>
          <div className="mx-auto grid w-full max-w-2xl grid-cols-2 gap-3 px-4 pb-6 sm:grid-cols-3">
            {extrasTiles
              .filter((key) =>
                moreGroup === "diagram" ? isDiagramType(key) : !isDiagramType(key),
              )
              .map((key) => (
              <ExtrasTile
                key={key}
                outputKey={key}
                isPending={(createMut.isPending && createMut.variables === key)}
                disabled={createMut.isPending}
                onActivate={() => { setMoreGroup(null); activateTile(key); }}
                onMoveToMain={() => { setMoreGroup(null); moveToMain(key); }}
              />
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function SectionHeading({
  label,
  variant,
}: {
  label: string;
  variant: "uml" | "docs" | "tools";
}) {
  const config = {
    uml: { underline: "bg-orange-300", underlineW: "w-6" },
    docs: { underline: "bg-rose-300", underlineW: "w-8" },
    tools: { underline: "bg-emerald-300", underlineW: "w-5" },
  }[variant];
  return (
    <div className="mb-3 flex flex-col items-center gap-1">
      <h2 className="text-base font-bold tracking-tight text-foreground/85 sm:text-lg leading-tight">
        {label}
      </h2>
      <div className={`h-1 rounded-full opacity-60 ${config.underline} ${config.underlineW}`} aria-hidden />
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
    <div className="flex h-10 items-center justify-center sm:h-12">
      <button
        type="button"
        disabled={disabled}
        onClick={onActivate}
        style={style}
        aria-label="עוד"
        title="עוד"
        className="animate-fade-in group inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-card text-muted-foreground shadow-sm ring-1 ring-border/60 transition-all hover:text-primary hover:ring-primary/40 hover:shadow-md active:scale-95 disabled:opacity-50 sm:h-10 sm:w-10"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
    </div>
  );
}

function SortableTile({
  outputKey,
  index,
  pending,
  disabled,
  draggable,
  onActivate,
  onMoveToExtras,
}: {
  outputKey: OutputKey;
  index: number;
  pending: boolean;
  disabled: boolean;
  draggable: boolean;
  onActivate: () => void;
  onMoveToExtras: () => void;
}) {
  const t = OUTPUT_TYPES[outputKey];
  const Icon = t.icon;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: outputKey,
    disabled: !draggable,
  });

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (clickTimer.current) clearTimeout(clickTimer.current); }, []);

  const handleClick = () => {
    if (isDragging) return;
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      if (!disabled) onMoveToExtras();
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      if (!disabled) onActivate();
    }, 260);
  };

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    animationDelay: `${index * 30}ms`,
    animationFillMode: "backwards",
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : undefined,
    touchAction: draggable ? "none" : undefined,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={disabled}
      onClick={handleClick}
      style={style}
      title="לחיצה: פתח | לחיצה כפולה: העבר ל'עוד'"
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
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

function ExtrasTile({
  outputKey,
  isPending,
  disabled,
  onActivate,
  onMoveToMain,
}: {
  outputKey: OutputKey;
  isPending: boolean;
  disabled: boolean;
  onActivate: () => void;
  onMoveToMain: () => void;
}) {
  const t = OUTPUT_TYPES[outputKey];
  const Icon = t.icon;

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (clickTimer.current) clearTimeout(clickTimer.current); }, []);

  const handleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      if (!disabled) onMoveToMain();
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      if (!disabled) onActivate();
    }, 260);
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      title="לחיצה: פתח | לחיצה כפולה: העבר למסך הראשי"
      className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-gradient-to-br from-card to-accent/30 p-3 text-center transition-colors hover:bg-accent/40 disabled:opacity-50"
    >
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent ${t.colorClass}`}>
        {isPending ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <Icon className="h-6 w-6" />
        )}
      </div>
      <div className="text-xs font-semibold leading-tight text-foreground">{t.label}</div>
    </button>
  );
}
