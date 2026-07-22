import type { PropsWithChildren } from "react";

type HeaderShellProps = PropsWithChildren<{
  className?: string;
}>;

export function HeaderShell({ children, className = "" }: HeaderShellProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-surface-raised/95 backdrop-blur">
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
