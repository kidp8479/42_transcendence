import type { PropsWithChildren } from "react";

type HeaderShellProps = PropsWithChildren<{
  className?: string;
}>;

export function HeaderShell({ children, className = "" }: HeaderShellProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-surface-raised/95 backdrop-blur">
      <div
        className={`mx-auto flex min-h-16 max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8 ${className}`}
      >
        {children}
      </div>
    </header>
  );
}
