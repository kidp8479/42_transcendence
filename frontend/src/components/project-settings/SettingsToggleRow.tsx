import { ToggleSwitch } from "flowbite-react";
import { SettingsRow } from "./SettingsRow";
import type { ReactNode } from "react";

interface SettingsToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ReactNode;
  iconClassName?: string;
}

export function SettingsToggleRow({
  title,
  description,
  checked,
  onChange,
  icon,
  iconClassName,
}: SettingsToggleRowProps) {
  return (
    <SettingsRow
      title={title}
      description={description}
      icon={icon}
      iconClassName={iconClassName}
    >
      <ToggleSwitch
        checked={checked}
        label=""
        onChange={onChange}
        color="green"
        // Flowbite's default focus ring (group-focus:ring-4) reads as huge -
        // shrink it, same fix as the Projects page's "Include archived"
        // toggle (routes/_authenticated/projects.tsx).
        theme={{ toggle: { base: "group-focus:ring-1" } }}
      />
    </SettingsRow>
  );
}
