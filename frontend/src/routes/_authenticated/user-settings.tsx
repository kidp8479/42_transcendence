// User settings page (/user-settings).
// Personal account settings: display name, email, theme, language, accent color, password, 2FA, delete account.
// Not to be confused with project-settings.tsx which configures a specific project.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/user-settings")({
  component: UserSettingsPage,
});

function UserSettingsPage() {
  return <div>Hello "/user-settings"!</div>;
}
