// Drag-to-resize grip on a drawer's left edge (see DrawerShell).
//
// Pointer capture rather than window listeners: once the pointer is captured
// on pointerdown, every subsequent move/up event retargets to this element
// even when the cursor leaves it - or leaves the window entirely - so there
// is no global listener to register, clean up, or leak.
//
// No dependency: a resizable panel is ~40 lines of pointer math, and the
// libraries that do it ship a full layout system we have no use for.
import { useRef } from "react";
// Aliased: React's synthetic event types share their names with the global
// DOM ones, and these handlers take the synthetic pair.
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

interface DrawerResizeHandleProps {
  width: number;
  minWidth: number;
  maxWidth: number;
  onWidthChange: (width: number) => void;
}

// How much one arrow-key press resizes by. Coarse on purpose: resizing a
// panel pixel by pixel from the keyboard would take hundreds of presses.
const KEYBOARD_STEP = 32;

export function DrawerResizeHandle({
  width,
  minWidth,
  maxWidth,
  onWidthChange,
}: DrawerResizeHandleProps) {
  // Where the drag started, or null when no drag is in progress. A ref, not
  // state: it changes on every pointermove and must not trigger a render.
  const dragOrigin = useRef<{ pointerX: number; width: number } | null>(null);

  function clampWidth(nextWidth: number): number {
    return Math.min(Math.max(nextWidth, minWidth), maxWidth);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Stops the drag from selecting the drawer's text as it sweeps across.
    event.preventDefault();
    dragOrigin.current = { pointerX: event.clientX, width: width };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const origin = dragOrigin.current;
    if (origin === null) {
      return;
    }
    // Inverted delta: the panel is anchored to the right edge, so dragging
    // the handle left (a smaller clientX) makes the panel wider.
    onWidthChange(clampWidth(origin.width + (origin.pointerX - event.clientX)));
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragOrigin.current === null) {
      return;
    }
    dragOrigin.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    // Left grows the panel and right shrinks it, matching the drag direction.
    const nextWidth =
      event.key === "ArrowLeft"
        ? width + KEYBOARD_STEP
        : event.key === "ArrowRight"
          ? width - KEYBOARD_STEP
          : event.key === "Home"
            ? maxWidth
            : event.key === "End"
              ? minWidth
              : null;

    if (nextWidth === null) {
      return;
    }
    event.preventDefault();
    onWidthChange(clampWidth(nextWidth));
  }

  return (
    <div
      // The window-splitter pattern: a focusable separator carrying its
      // current and allowed sizes.
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize task drawer"
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      // touch-none (touch-action: none) is required: without it a touch drag
      // scrolls the page instead of resizing.
      className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize touch-none transition-colors hover:bg-brand-500/40 focus-visible:bg-brand-500/60"
    />
  );
}
