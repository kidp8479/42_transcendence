import type { ReactNode } from "react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  variant?: "default" | "danger";
}

export function SettingsSection({
  title,
  description,
  children,
  variant = "default",
}: SettingsSectionProps) {
  const sectionClasses =
    variant === "danger"
      ? "border-red-500/30 bg-red-500/5"
      : "border-surface-border bg-surface-raised";

  const headerClasses =
    variant === "danger" ? "border-red-500/20" : "border-surface-border";

  const titleClasses =
    variant === "danger" ? "text-red-400" : "text-text-primary";

  return (
    <section className={`rounded-lg border ${sectionClasses}`}>
      <div className={`border-b p-5 ${headerClasses}`}>
        <h2 className={`font-mono text-base font-semibold ${titleClasses}`}>
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-xs text-text-secondary">{description}</p>
        )}
      </div>

      <div className="p-5">{children}</div>
    </section>
  );
}
