// Base container for all drawers.
// A drawer is a slide-in panel from the right side of the screen, used to show
// the detail view of an item (kanban card, list task, calendar event) without
// navigating away from the current page.
//
// DrawerShell handles the shared visual structure:
// - Slide-in animation from the right
// - Overlay/backdrop behind the panel
// - Click-outside-to-close and Escape-to-close behavior
// - Scroll area for long content
//
// It does NOT know what content it displays, and it does NOT render a visible
// close button itself - each specific drawer's own header (KanBanCardDrawer,
// ListItemDrawer, CalendarEventDrawer...) renders its own close icon and calls
// the onClose prop, since header layout differs per drawer.
//
// Similar in concept to ModalLayer, but a drawer anchors to the side rather
// than centering on screen, and stays mounted (translated off-screen) instead
// of unmounting on close, so the slide-out transition can play.
//
// "absolute inset-0", not "fixed inset-0": bounds itself to the nearest
// positioned ancestor (the root layout's content wrapper, see __root.tsx)
// instead of the whole viewport, so the panel slides in between the header
// and footer rather than covering them (matches the Figma mockup).
import { useEffect, type ReactNode } from "react";

interface DrawerShellProps {
  isOpen: boolean;
  // always a full close - backdrop click and the drawer's own close icon
  // both use this.
  onClose: () => void;
  children: ReactNode;
  // "max-w-md" (narrow side panel) by default - callers with an expand/
  // collapse affordance (ex: CalendarEventDrawer) can widen this.
  widthClassName?: string;
  // Escape key handler, defaults to onClose. Callers with an expand/collapse
  // affordance can stage it instead: collapse back to the side panel on the
  // first Escape, only close on a second one while already collapsed.
  onEscape?: () => void;
  // id of the element that names this dialog (ex: the header title), wired
  // to aria-labelledby - a role="dialog" with no accessible name fails
  // WCAG 4.1.2 (confirmed by axe's aria-dialog-name rule).
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
      // inert, not aria-hidden: aria-hidden only hides content from screen
      // readers, it does not remove it from the tab order - a closed drawer
      // still had its header buttons focusable while aria-hidden, which
      // browsers now actively warn about ("Blocked aria-hidden on an element
      // because its descendant retained focus"). inert removes focusability
      // too while the panel is closed/translated off-screen.
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
