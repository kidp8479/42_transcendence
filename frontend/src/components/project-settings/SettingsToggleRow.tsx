import { ToggleSwitch } from "flowbite-react";
import { SettingsRow } from "./SettingsRow";
import type { ReactNode } from "react";

// TODO: Customize Flowbite ToggleSwitch appearance to use app brand-500
// green and remove focus styling once settings functionality is comploete.

interface SettingsToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
}

export function SettingsToggleRow({
  title,
  description,
  checked,
  onChange,
  icon,
}: SettingsToggleRowProps) {
  return (
    <SettingsRow title={title} description={description} icon={icon}>
      <ToggleSwitch checked={checked} label="" onChange={onChange} />
    </SettingsRow>
  );
}
