import type { PropsWithChildren } from "react";

type HeaderShellProps = PropsWithChildren<{
  className?: string;
}>;

export function HeaderShell({ children, className = "" }: HeaderShellProps) {
  return (
    // z-50, not z-40: the header sits at the same DOM level as page content
    // (see __root.tsx), so an open DrawerShell (also z-40, but later in the
    // DOM) would otherwise win the stacking tie and paint over the header -
    // including the notification bell's dropdown, making it unopenable
    // while a drawer (ex: CalendarEventDrawer) is open. Same reasoning as
    // SideBarCmp's own z-50, see its comment.
    <header className="sticky top-0 z-50 border-b border-surface-border bg-surface-raised/95 backdrop-blur">
      {/* No max-width/mx-auto here on purpose: the header should reach the
          real edges of the viewport. That's different from page content
          (see LayoutContainer, used by Footer), which is capped and centered
          intentionally. */}
      <div
        className={`flex min-h-16 items-center px-4 sm:px-6 lg:px-10 ${className}`}
      >
        {children}
      </div>
    </header>
  );
}
