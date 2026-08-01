// User settings page (/user-settings).
// Personal account settings: display name, email, theme, language, accent color, password, 2FA, delete account.
// Not to be confused with project-settings.tsx which configures a specific project.
import {
  Avatar,
  Button,
  FileInput,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  TextInput,
  // ToggleSwitch,
} from "flowbite-react";
import { useState } from "react";
import { HiOutlineExclamationTriangle } from "react-icons/hi2";
import { darkSurfaceTextInputTheme } from "@/lib/flowbite";

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { getMe, updateMe, deleteMe, uploadAvatar } from "@/lib/userSettingsApi";
import { authSessionResource } from "@/lib/authState";

import { useSafeRouterInvalidate } from "@/hooks/useSafeRouterInvalidate";
import { useToast } from "@/hooks/useToast";

// Second step of the delete-account flow forces the user to type this
// phrase verbatim - a plain "Confirm" click is too easy to hit by mistake
// for a destructive, unrecoverable action.
const DELETE_CONFIRMATION_PHRASE =
  "I acknowledge that will be lost forever but I want to delete it anyway";

// theme override shared by the delete-account modal - matches the
// surface/border tokens ModalLayer.tsx uses for the auth modal, instead of
// Flowbite's default light popup card.
const darkSurfaceModalTheme = {
  content: {
    inner:
      "relative flex max-h-[90dvh] flex-col rounded-2xl border border-surface-border bg-surface-raised shadow-2xl",
  },
};

export const Route = createFileRoute("/_authenticated/user-settings")({
  loader: () => getMe(),
  component: UserSettingsPage,
});

const rowClass = "flex items-center justify-between gap-6 pb-4";

const rowClassBorder =
  "flex items-center justify-between gap-6 pb-4 border-b border-surface-border";

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

type DeleteAccountStep = "confirm" | "type-to-confirm";

function UserSettingsPage() {
  const user = Route.useLoaderData();
  const navigate = useNavigate();
  const safeInvalidateRouter = useSafeRouterInvalidate();
  const { showToast } = useToast();
  const [openModalUploadAvatar, setOpenModalUploadAvatar] = useState(false);
  const [deleteAccountStep, setDeleteAccountStep] =
    useState<DeleteAccountStep | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [displayedName, setDisplayedName] = useState(user.username);
  // const [displayedCampus, setDisplayedCampus] = useState(user.campus);
  // const [switch2FA, setSwitch2FA] = useState(false);

  function closeDeleteAccountModal() {
    setDeleteAccountStep(null);
    setDeleteConfirmationText("");
  }

  async function handleUpload(file: File | null) {
    if (!file) return;
    try {
      await uploadAvatar(file);
      safeInvalidateRouter();
    } catch {
      showToast({ type: "error", message: "Upload failed. Please retry." });
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteMe();
      authSessionResource.setAnonymous();
      await navigate({ to: "/" });
    } catch {
      showToast({
        type: "error",
        message: "Account deletion failed. Please retry.",
      });
      setDeleting(false);
    }
  }

  async function handleSaveChanges() {
    const changes: Partial<typeof user> = {};

    if (displayedName !== user.username) {
      changes.username = displayedName;
    }
    // if (displayedCampus !== user.campus) {
    //   changes.campus = displayedCampus;
    // }

    try {
      await updateMe({
        username: changes.username,
        email: changes.email,
        campus: changes.campus,
      });
      safeInvalidateRouter();
    } catch {
      showToast({ type: "error", message: "Saving failed. Please retry." });
    }
  }

  return (
    <>
      <Modal
        show={openModalUploadAvatar}
        dismissible
        size="md"
        onClose={() => setOpenModalUploadAvatar(false)}
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
                // setFile(selectedFile?.[0] ?? null);
                setOpenModalUploadAvatar(false);
                handleUpload(selectedFile?.[0] ?? null);
              }}
            />
          </Label>
        </div>
      </Modal>

      <Modal
        show={deleteAccountStep !== null}
        dismissible
        size="md"
        theme={darkSurfaceModalTheme}
        onClose={closeDeleteAccountModal}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="flex flex-col items-center gap-4 pb-2 text-center">
            <HiOutlineExclamationTriangle className="h-10 w-10 text-control-error" />

            {deleteAccountStep === "confirm" && (
              <>
                <h3 className="text-lg font-semibold text-text-primary">
                  Deleting an account is permanent, do you wish to continue?
                </h3>
                <p className="text-sm text-text-secondary">
                  This will permanently remove your account and all associated
                  data. This action cannot be undone.
                </p>
                <div className="mt-2 flex w-full justify-center gap-3">
                  <Button
                    className={rowUploadButtonClass}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      closeDeleteAccountModal();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="red"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setDeleteAccountStep("type-to-confirm");
                    }}
                  >
                    Continue
                  </Button>
                </div>
              </>
            )}

            {deleteAccountStep === "type-to-confirm" && (
              <>
                <h3 className="text-lg font-semibold text-text-primary">
                  Last chance
                </h3>
                <p className="text-sm text-text-secondary">
                  Type{" "}
                  <span className="font-semibold text-text-primary">
                    &quot;{DELETE_CONFIRMATION_PHRASE}&quot;
                  </span>{" "}
                  below to confirm.
                </p>
                <TextInput
                  className="w-full"
                  theme={darkSurfaceTextInputTheme}
                  value={deleteConfirmationText}
                  disabled={deleting}
                  onChange={(e) => {
                    setDeleteConfirmationText(e.currentTarget.value);
                  }}
                />
                <div className="mt-2 flex w-full justify-center gap-3">
                  <Button
                    className={rowUploadButtonClass}
                    disabled={deleting}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      closeDeleteAccountModal();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="red"
                    disabled={
                      deleting ||
                      deleteConfirmationText !== DELETE_CONFIRMATION_PHRASE
                    }
                    onClick={(e) => {
                      e.currentTarget.blur();
                      handleDelete();
                    }}
                  >
                    {deleting ? "Deleting..." : "Delete account"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </ModalBody>
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
                placeholderInitials={user.username.slice(0, 2).toUpperCase()}
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
                    setOpenModalUploadAvatar(true);
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
                onBlur={(e) => {
                  setDisplayedName(e.currentTarget.value);
                }}
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
                value={user.email}
                disabled
              />
            </section>

            <section
              className={rowClassBorder}
              aria-labelledby="account-campus-area"
            >
              <div>
                <Label className="font-semibold text-text-primary">
                  Campus
                </Label>
              </div>
              <TextInput
                className="w-80"
                theme={darkSurfaceTextInputTheme}
                type="campus"
                value={user.campus ?? ""}
                disabled
                // onBlur={ (e) => {
                //   setDisplayedCampus(e.currentTarget.value);
                // }}
              />
            </section>

            <div>
              <Button
                className="bg-brand-500 text-gray-900 hover:bg-brand-600 focus:ring-1 focus:ring-green-300 dark:bg-brand-500 dark:text-gray-900 dark:hover:bg-brand-600 dark:focus:ring-green-800"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleSaveChanges();
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
            {/* 
              PASSWORD CHANGE UI
            */}
            {/* <h2 className="font-mono uppercase text-xs font-semibold text-text-muted">
              Security
            </h2>

            <section className={rowClassBorder} aria-labelledby="password-area">
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
            </section> */}

            {/*
              2-FA UI
            */}
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
                  setDeleteAccountStep("confirm");
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
