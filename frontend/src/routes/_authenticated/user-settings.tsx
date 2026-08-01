// User settings page (/user-settings).
// Personal account settings: display name, email, theme, language, accent color, password, 2FA, delete account.
// Not to be confused with project-settings.tsx which configures a specific project.
import {
  Avatar,
  Button,
  FileInput,
  Label,
  Modal,
  TextInput,
  ToggleSwitch,
} from "flowbite-react";
import { useState } from "react";
import { darkSurfaceTextInputTheme } from "@/lib/flowbite";

import { createFileRoute, useLoaderData } from "@tanstack/react-router";
import { UploadFile, fileDownloadUrl } from "@/lib/rustfsApi";

import { getMe, updateMe, User } from "@/lib/userSettingsApi";

export const Route = createFileRoute("/_authenticated/user-settings")({
  loader: () => getMe(),
  component: UserSettingsPage,
});

const rowClass =
  "flex items-center justify-between gap-6 border-b border-surface-border pb-4";
const rowUploadButtonClass = `
  bg-surface-overlay
  dark:bg-surface-overlay!
  text-text-primary
  dark:text-text-primary
  text-xs
  dark:text-xs
  hover:ring-1
  hover:ring-surface-border
  focus:ring-1
  focus:ring-brand-500
  dark:hover:ring-1
  dark:hover:ring-surface-border
  dark:focus:ring-1
  dark:focus:ring-brand-500
`;

function UserSettingsPage() {

  const user = Route.useLoaderData();

  const [openModal, setOpenModal] = useState(false);

  const [switch2FA, setSwitch2FA] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleUpload(file: File | null) {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await UploadFile(file);
      setKey(result.key);
      await updateMe({ avatarUrl: fileDownloadUrl(result.key) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Modal
        show={openModal}
        dismissible
        size="md"
        onClose={() => setOpenModal(false)}
        popup
      >
        <div className="flex w-full items-center justify-center">
          <Label
            htmlFor="dropzone-file"
            className="flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600"
          >
            <div className="flex flex-col items-center justify-center pb-6 pt-5">
              <svg
                className="mb-4 h-8 w-8 text-gray-500 dark:text-gray-400"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 20 16"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                />
              </svg>
              <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                <span className="font-semibold">Click to upload</span> or drag
                and drop
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                SVG, PNG, JPG or GIF (MAX. 800x400px)
              </p>
            </div>
            <FileInput
              id="dropzone-file"
              className="hidden"
              onChange={(e) => {
                const selectedFile = e.target.files;
                setFile(selectedFile?.[0] ?? null);
                setOpenModal(false);
                handleUpload(selectedFile?.[0] ?? null);
              }}
            />
          </Label>
        </div>
      </Modal>

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
                img={user.avatarUrl || undefined}
                placeholderInitials= {user.username.slice(0, 2).toUpperCase()}
                rounded
              />

              <section
                className="flex flex-col gap-2"
                aria-labelledby="profile-picture-upload-area"
              >
                <Label className="font-semibold text-text-primary">
                  {user.username}
                </Label>
                <Button
                  size="sm"
                  className={rowUploadButtonClass}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setOpenModal(true);
                  }}
                >
                  Upload photo
                </Button>
              </section>
            </section>

            <section className={rowClass} aria-labelledby="displayed-name-area">
              <Label className="font-semibold text-text-primary shrink-0">
                Display name
              </Label>
              <TextInput
                className="w-80"
                theme={darkSurfaceTextInputTheme}
                defaultValue={user.username}
              />
            </section>

            <section className={rowClass} aria-labelledby="account-email-area">
              <div>
                <Label className="font-semibold text-text-primary">Email</Label>
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
                className="bg-brand-500 text-gray-900 hover:bg-brand-600 focus:ring-1 focus:ring-green-300 dark:bg-brand-500 dark:text-gray-900 dark:hover:bg-brand-600 dark:focus:ring-green-800"
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

            {/* <section className={rowClass} aria-labelledby="two-factor-area">
              <div>
                <Label className="font-semibold text-text-primary">
                  Two-factor authentication
                </Label>
                <p className="text-xs text-text-secondary">
                  Add an extra layer of protection
                </p>
              </div>
              <ToggleSwitch checked={switch2FA} onChange={setSwitch2FA} />
            </section> */}
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
                className="focus:ring-1 darkfocus:ring-1"
                size="sm"
                color="red"
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
    </>
  );
}
