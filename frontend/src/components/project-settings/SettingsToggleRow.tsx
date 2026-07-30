import { ToggleSwitch } from "flowbite-react";
import { SettingsRow } from "./SettingsRow";

// TODO: Customize Flowbite ToggleSwitch appearance to use app brand-500
// green and remove focus styling once settings functionality is comploete.

interface SettingsToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SettingsToggleRow({
  title,
  description,
  checked,
  onChange,
}: SettingsToggleRowProps) {
  return (
    <SettingsRow title={title} description={description}>
      <ToggleSwitch checked={checked} label="" onChange={onChange} />
    </SettingsRow>
  );
}
