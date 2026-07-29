// User settings page (/user-settings).
// Personal account settings: display name, email, theme, language, accent color, password, 2FA, delete account.
// Not to be confused with project-settings.tsx which configures a specific project.
import {
  Avatar,
  Button,
  Label,
  TextInput,
  ToggleSwitch
 } from "flowbite-react";
import { useState } from "react"
import { darkSurfaceTextInputTheme } from "@/lib/flowbite";

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/user-settings")({
  component: UserSettingsPage,
});

const rowClass = "flex items-center justify-between gap-6 border-b border-surface-border pb-4";
const rowUploadButtonClass = `
  bg-surface-overlay
  dark:bg-surface-overlay!
  text-text-primary
  dark:text-text-primary
  text-xs
  dark:text-xs
  hover:ring-1
  hover:ring-surface-border
  focus:ring-0
  dark:hover:ring-1
  dark:hover:ring-surface-border
  dark:focus:ring-0
`;

function UserSettingsPage() {
  const [switch2FA, setSwitch2FA] = useState(false);
  const userName = "Christophe";

  return (
    <div className="w-full mx-10">
      <h1 className="font-mono text-xl my-10 font-semibold text-text-primary">
        Settings
      </h1>

      <div className="max-w-xl flex flex-col gap-4">
        <section
          className="flex flex-col gap-4"
          aria-labelledby="profile-picture-and-name-heading"
        >
          <h2 className="font-mono uppercase text-xs font-semibold text-text-muted">
            Profile
          </h2>
          <section
            className="flex items-center gap-4 pb-4 border-b border-surface-border"
            aria-labelledby="profile-picture-area"
          >
            <Avatar
              size="lg"
              placeholderInitials={userName}
              rounded
            />
            <section
              className="flex flex-col gap-2"
              aria-labelledby="profile-picture-upload-area"
            >
              <Label className="font-semibold text-text-primary">
                {userName}
              </Label>
              <Button
                size="sm"
                className={rowUploadButtonClass}
                onClick={(e) => {
                  e.currentTarget.blur();
                }}
              >
                Upload photo
              </Button>
            </section>
          </section>

          <p className="text-xs text-text-secondary -mt-2 pb-4 border-b border-surface-border">
            You can upload a custom photo. If none is set, your avatar will
            display your initials on a colored background — no action
            required.
          </p>

          <section className={rowClass} aria-labelledby="displayed-name-area">
            <Label className="font-semibold text-text-primary shrink-0">
              Display name
            </Label>
            <TextInput
              className="w-80"
              theme={darkSurfaceTextInputTheme}
              defaultValue={userName}
            />
          </section>

          <section className={rowClass} aria-labelledby="account-email-area">
            <div>
              <Label className="font-semibold text-text-primary">
                Email
              </Label>
              <p className="text-xs text-text-secondary">
                Used for account recovery
              </p>
            </div>
            <TextInput
              className="w-80"
              theme={darkSurfaceTextInputTheme}
              type="email"
            />
          </section>

          <div>
            <Button
              className="bg-brand-500 text-gray-900 hover:bg-brand-600 focus:ring-4 focus:ring-green-300 dark:bg-brand-500 dark:text-gray-900 dark:hover:bg-brand-600 dark:focus:ring-green-800"
              onClick={(e) => {
                e.currentTarget.blur();
              }}
            >
              Save changes
            </Button>
          </div>
        </section>

        <section
          className="flex flex-col gap-4 mt-6"
          aria-labelledby="security-heading"
        >
          <h2 className="font-mono uppercase text-xs font-semibold text-text-muted">
            Security
          </h2>

          <section className={rowClass} aria-labelledby="password-area">
            <div>
              <Label className="font-semibold text-text-primary">
                Password
              </Label>
              <p className="text-xs text-text-secondary">
                Last changed never
              </p>
            </div>
            <Button
              size="sm"
              className={rowUploadButtonClass}
              onClick={(e) => {
                e.currentTarget.blur();
              }}
            >
              Change
            </Button>
          </section>

          <section className={rowClass} aria-labelledby="two-factor-area">
            <div>
              <Label className="font-semibold text-text-primary">
                Two-factor authentication
              </Label>
              <p className="text-xs text-text-secondary">
                Add an extra layer of protection
              </p>
            </div>
            <ToggleSwitch checked={switch2FA} onChange={setSwitch2FA} />
          </section>
        </section>

        <section
          className="flex flex-col gap-4 mt-6"
          aria-labelledby="danger-zone-heading"
        >
          <h2 className="font-mono uppercase text-xs font-semibold text-text-muted">
            Danger zone
          </h2>

          <section className={rowClass} aria-labelledby="delete-account-area">
            <div>
              <Label className="font-semibold text-control-error">
                Delete account
              </Label>
              <p className="text-xs text-text-secondary">
                Permanently remove your account and all data
              </p>
            </div>
            <Button
              size="sm"
              color="failure"
              outline
              onClick={(e) => {
                e.currentTarget.blur();
              }}
            >
              Delete
            </Button>
          </section>
        </section>
      </div>
    </div>
  );
}
