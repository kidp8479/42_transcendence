// Base container for all drawers - a slide-in side panel used to show the
// detail view of an item (kanban card, list task, calendar event) without
// leaving the current page.
//
// Handles the shared structure: slide-in animation, backdrop, click-outside
// and Escape to close, scroll area. It does NOT render its own close button
// or know what content it displays - each drawer (KanBanCardDrawer,
// CalendarEventDrawer...) renders its own header and passes children in.
//
// Similar to ModalLayer, but anchored to the side instead of centered, and
// stays mounted (just translated off-screen) so the close animation can play.
//
// "absolute inset-0" (not "fixed"): bounds the drawer to the layout's
// content area instead of the whole viewport, so it slides in between the
// header and sidebar rather than covering them.
import { useEffect, type ReactNode } from "react";

interface DrawerShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  // narrow side panel by default - callers with an expand/collapse
  // affordance (ex: CalendarEventDrawer) can widen this
  widthClassName?: string;
  // defaults to onClose - callers with an expand/collapse affordance can
  // stage it instead: collapse on the first Escape, close on the second
  onEscape?: () => void;
  // id of the element that names this dialog, wired to aria-labelledby
  titleId?: string;
}

export function DrawerShell({
  isOpen,
  onClose,
  children,
  widthClassName = "max-w-md",
  onEscape = onClose,
  titleId,
}: DrawerShellProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onEscape();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onEscape]);

  return (
    <div
      className={
        "absolute inset-0 z-40 transition-opacity duration-300 " +
        (isOpen
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0")
      }
      // inert (not aria-hidden): also removes the closed drawer's buttons
      // from the tab order, not just from screen readers
      inert={!isOpen}
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      ></div>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={
          "scrollbar-thin-surface absolute top-0 right-0 flex h-full w-full flex-col overflow-y-auto border-l border-surface-border bg-surface-raised shadow-2xl transition-[transform,max-width] duration-300 " +
          widthClassName +
          " " +
          (isOpen ? "translate-x-0" : "translate-x-full")
        }
      >
        {children}
      </div>
    </div>
  );
}
