import type { ReactNode } from "react";

import { SettingsRow } from "./SettingsRow";

interface SettingsActionRowProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function SettingsActionRow({
  title,
  description,
  children,
}: SettingsActionRowProps) {
  return (
    <SettingsRow title={title} description={description}>
      {children}
    </SettingsRow>
  );
}
