import type { PropsWithChildren } from "react";

type LayoutContainerProps = PropsWithChildren<{
  className?: string;
}>;

export function LayoutContainer({
  children,
  className = "",
}: LayoutContainerProps) {
  return (
    <div
      className={`mx-auto min-h-16 max-w-screen-2xl px-4 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}
