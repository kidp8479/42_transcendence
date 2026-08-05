import type { ReactNode } from "react";

import { SettingsRow } from "./SettingsRow";

interface SettingsActionRowProps {
  title: string;
  description: string;
  children: ReactNode;
  icon?: ReactNode;
  iconClassName?: string;
}

export function SettingsActionRow({
  title,
  description,
  children,
  icon,
  iconClassName,
}: SettingsActionRowProps) {
  return (
    <SettingsRow
      title={title}
      description={description}
      icon={icon}
      iconClassName={iconClassName}
    >
      {children}
    </SettingsRow>
  );
}
