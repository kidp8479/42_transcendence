import type { ReactNode } from "react";

interface SettingsRowProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function SettingsRow({
  title,
  description,
  children,
}: SettingsRowProps) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-medium text-text-primary">{title}</h3>

        <p className="mt-1 text-xs text-text-secondary">{description}</p>
      </div>

      <div className="shrink-0">{children}</div>
    </div>
  );
}
