import { useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

interface SwipeableRowProps {
  children: ReactNode;
  onDelete?: () => void;
  className?: string;
}

const REVEAL = 80;
const TRIGGER = 140;

export function SwipeableRow({ children, onDelete, className }: SwipeableRowProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const decided = useRef<"h" | "v" | null>(null);

  if (!onDelete) {
    return <div className={className}>{children}</div>;
  }

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    decided.current = null;
    setDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (decided.current === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      decided.current = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
    }
    if (decided.current !== "h") return;
    // Only swipe to the left (negative dx) reveals delete on the left side.
    if (dx < 0) {
      setDragX(Math.max(dx, -TRIGGER - 40));
    } else {
      setDragX(0);
    }
  };

  const onTouchEnd = () => {
    setDragging(false);
    const abs = Math.abs(dragX);
    if (abs >= TRIGGER) {
      setDragX(0);
      onDelete();
    } else if (abs >= REVEAL) {
      setDragX(-REVEAL);
    } else {
      setDragX(0);
    }
  };

  const reset = () => setDragX(0);

  return (
    <div className={`relative overflow-hidden md:overflow-visible ${className ?? ""}`}>
      <button
        type="button"
        aria-label="מחק"
        onClick={() => {
          reset();
          onDelete();
        }}
        className="absolute inset-y-0 left-0 z-0 flex w-20 items-center justify-center bg-destructive text-destructive-foreground md:hidden"
        style={{ opacity: Math.min(1, Math.abs(dragX) / REVEAL) }}
      >
        <Trash2 className="h-5 w-5" />
      </button>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => {
          if (dragX !== 0) reset();
        }}
        className="relative z-10 bg-background"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
