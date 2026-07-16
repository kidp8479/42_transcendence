import type { PropsWithChildren } from "react";
import { LayoutContainer } from "./LayoutContainer";

type HeaderShellProps = PropsWithChildren<{
  className?: string;
}>;

export function HeaderShell({ children, className = "" }: HeaderShellProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-surface-border bg-surface-raised/95 backdrop-blur">
      <LayoutContainer className={`flex items-center ${className}`}>
        {children}
      </LayoutContainer>
    </header>
  );
}
