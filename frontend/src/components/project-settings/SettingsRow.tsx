import type { ReactNode } from "react";

interface SettingsRowProps {
  title: string;
  description: string;
  children: ReactNode;
  icon?: ReactNode;
  iconClassName?: string;
}

export function SettingsRow({
  title,
  description,
  children,
  icon,
  iconClassName,
}: SettingsRowProps) {
  return (
    <div className="flex flex-col items-start gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-1 gap-3">
        {icon && (
          <div
            className={`
			  flex
			  h-10
			  w-10
			  shrink-0
			  items-center
			  justify-center
			  rounded-lg
			  border
			  border-surface-border
			  bg-surface-overlay
			  text-text-secondary
			  ${iconClassName ?? ""}
            `}
          >
            {icon}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium text-text-primary">{title}</h3>

          <p className="mt-1 text-xs text-text-secondary">{description}</p>
        </div>
      </div>

      <div className="shrink-0">{children}</div>
    </div>
  );
}
