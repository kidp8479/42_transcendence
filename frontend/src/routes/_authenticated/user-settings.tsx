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
import { ApiError } from "@/lib/apiClient";

import { useSafeRouterInvalidate } from "@/hooks/useSafeRouterInvalidate";
import { useToast } from "@/hooks/useToast";

const DISPLAY_NAME_MIN_LENGTH = 3;
const DISPLAY_NAME_MAX_LENGTH = 32;

// mirrors backend/src/users/users.controller.ts's MAX_AVATAR_BYTES - checked
// client-side too so an oversized file is rejected instantly instead of
// after a full upload round trip
const MAX_AVATAR_BYTES = 1 * 1024 * 1024;

// Second step of the delete-account flow forces the user to type this
// phrase verbatim - a plain "Confirm" click is too easy to hit by mistake
// for a destructive, unrecoverable action.
const DELETE_CONFIRMATION_PHRASE =
  "I acknowledge that my account will be lost forever and I want to delete it anyway";

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

const rowClass =
  "flex flex-col items-start gap-2 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6";

const rowClassBorder = `${rowClass} border-b border-surface-border`;

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
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deleteAccountStep, setDeleteAccountStep] =
    useState<DeleteAccountStep | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [displayedName, setDisplayedName] = useState(user.username);
  // const [displayedCampus, setDisplayedCampus] = useState(user.campus);
  // const [switch2FA, setSwitch2FA] = useState(false);

  function closeDeleteAccountModal() {
    setDeleteAccountStep(null);
    setDeleteConfirmationText("");
  }

  async function handleUpload(file: File | null) {
    // guards against a second upload firing while one is already in flight -
    // without this, two uploads can resolve out of order and the one that
    // resolves last (not necessarily the most recent) wins the header/avatar
    if (!file || uploadingAvatar) return;

    // reject obviously-bad files up front - matches what the backend
    // enforces (MAX_AVATAR_BYTES, image/* mimetype), so the user gets an
    // answer immediately instead of after a full upload round trip that was
    // always going to fail
    if (!/^(image\/png|image\/jpeg|image\/gif)$/.test(file.type)) {
      showToast({
        type: "error",
        message: "Avatar must be a PNG, JPEG or GIF image.",
      });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showToast({
        type: "error",
        message: "Image is too large. Max size is 1 MB.",
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      const updated = await uploadAvatar(file);

      // safeInvalidateRouter() below only refreshes this page's own `user`
      // (from the route loader). The header reads the avatar from
      // authSessionResource instead, a separate store, so it needs to be
      // patched here directly or it stays stale until the session refetches.
      const authState = authSessionResource.getState();
      if (authState?.status === "authenticated") {
        authSessionResource.setAuthenticated({
          ...authState.session,
          user: { ...authState.session.user, avatarUrl: updated.avatarUrl },
        });
      }
      safeInvalidateRouter();
    } catch (error) {
      // a 401 means the session is already dead server-side - same handling
      // as UserMenu.handleLogout: drop the local session and send the user
      // back through re-auth instead of leaving them on a page that still
      // thinks they're signed in
      if (error instanceof ApiError && error.status === 401) {
        await authSessionResource.endSession();
        await navigate({ to: "/" });
        return;
      }
      // the client-side checks above cover the common size/type cases, but
      // the backend is the source of truth - a 413/400 here means those
      // checks disagreed with it (or were bypassed), so retrying the same
      // file would just fail again the same way, unlike a network blip
      if (error instanceof ApiError && error.status === 413) {
        showToast({
          type: "error",
          message: "Image is too large. Max size is 1 MB.",
        });
      } else if (error instanceof ApiError && error.status === 400) {
        showToast({
          type: "error",
          message: "This file can't be used as an avatar.",
        });
      } else {
        showToast({ type: "error", message: "Upload failed. Please retry." });
      }
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteMe();
      authSessionResource.setAnonymous();
      await navigate({ to: "/" });
    } catch (error) {
      // same reasoning as handleUpload's 401 branch above
      if (error instanceof ApiError && error.status === 401) {
        await authSessionResource.endSession();
        await navigate({ to: "/" });
        return;
      }
      showToast({
        type: "error",
        message: "Account deletion failed. Please retry.",
      });
      setDeleting(false);
    }
  }

  async function handleSaveChanges() {
    if (savingChanges) return;
    const changes: Partial<typeof user> = {};

    if (displayedName !== user.username) {
      changes.username = displayedName;
    }
    // if (displayedCampus !== user.campus) {
    //   changes.campus = displayedCampus;
    // }

    if (Object.keys(changes).length === 0) return;

    setSavingChanges(true);
    try {
      await updateMe({
        username: changes.username,
        email: changes.email,
        campus: changes.campus,
      });
      safeInvalidateRouter();
    } catch {
      showToast({ type: "error", message: "Saving failed. Please retry." });
    } finally {
      setSavingChanges(false);
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
                PNG, JPG or GIF
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
              accept="image/*"
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
                <div className="mt-2 flex w-full flex-col justify-center gap-3 sm:flex-row">
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
                <p
                  id="delete-confirm-phrase"
                  className="text-sm text-text-secondary"
                >
                  Type{" "}
                  <span className="font-semibold text-text-primary">
                    &quot;{DELETE_CONFIRMATION_PHRASE}&quot;
                  </span>{" "}
                  below to confirm.
                </p>
                <Label htmlFor="delete-confirm-input" className="sr-only">
                  Confirmation phrase
                </Label>
                <TextInput
                  id="delete-confirm-input"
                  aria-describedby="delete-confirm-phrase"
                  className="w-full"
                  theme={darkSurfaceTextInputTheme}
                  value={deleteConfirmationText}
                  disabled={deleting}
                  onChange={(e) => {
                    setDeleteConfirmationText(e.currentTarget.value);
                  }}
                  maxLength={DELETE_CONFIRMATION_PHRASE.length}
                />
                <div className="mt-2 flex w-full flex-col justify-center gap-3 sm:flex-row">
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

      <div className="w-full px-4 sm:px-10">
        <h1 className="font-mono text-xl my-6 sm:my-10 font-semibold text-text-primary">
          Settings
        </h1>

        <div className="max-w-xl flex flex-col gap-4">
          <section
            className="flex flex-col gap-4"
            aria-labelledby="profile-picture-and-name-heading"
          >
            <h2
              id="profile-picture-and-name-heading"
              className="font-mono uppercase text-xs font-semibold text-text-muted"
            >
              Profile
            </h2>
            <div className="flex items-center gap-4 pb-4 border-b border-surface-border">
              <Avatar
                size="lg"
                img={user.avatarUrl || undefined}
                placeholderInitials={user.username.slice(0, 2).toUpperCase()}
                rounded
              />

              <div className="flex min-w-0 flex-col gap-2">
                <Label className="font-semibold text-text-primary break-words">
                  {user.username}
                </Label>
                <Button
                  size="sm"
                  className={rowUploadButtonClass}
                  disabled={uploadingAvatar}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setOpenModalUploadAvatar(true);
                  }}
                >
                  {uploadingAvatar ? "Uploading..." : "Upload photo"}
                </Button>
              </div>
            </div>

            <div className={rowClass}>
              <Label
                htmlFor="display-name-input"
                className="font-semibold text-text-primary shrink-0"
              >
                Display name
              </Label>
              <TextInput
                id="display-name-input"
                className="w-full sm:w-80"
                theme={darkSurfaceTextInputTheme}
                defaultValue={user.username}
                onBlur={(e) => {
                  if (e.currentTarget.value.length >= DISPLAY_NAME_MIN_LENGTH) {
                    setDisplayedName(e.currentTarget.value);
                  } else {
                    e.currentTarget.value = displayedName;
                  }
                }}
                maxLength={DISPLAY_NAME_MAX_LENGTH}
              />
            </div>

            <div className={rowClass}>
              <div>
                <Label
                  htmlFor="email-input"
                  className="font-semibold text-text-primary"
                >
                  Email
                </Label>
                <p className="text-xs text-text-secondary">
                  Used for account recovery
                </p>
              </div>
              <TextInput
                id="email-input"
                className="w-full sm:w-80"
                theme={darkSurfaceTextInputTheme}
                type="email"
                value={user.email}
                disabled
              />
            </div>

            <div className={rowClassBorder}>
              <div>
                <Label
                  htmlFor="campus-input"
                  className="font-semibold text-text-primary"
                >
                  Campus
                </Label>
              </div>
              <TextInput
                id="campus-input"
                className="w-full sm:w-80"
                theme={darkSurfaceTextInputTheme}
                type="text"
                value={user.campus ?? ""}
                disabled
                // onBlur={ (e) => {
                //   setDisplayedCampus(e.currentTarget.value);
                // }}
              />
            </div>

            <div>
              <Button
                className="bg-brand-500 text-gray-900 hover:bg-brand-600 focus:ring-1 focus:ring-green-300 dark:bg-brand-500 dark:text-gray-900 dark:hover:bg-brand-600 dark:focus:ring-green-800"
                disabled={savingChanges}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleSaveChanges();
                }}
              >
                {savingChanges ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </section>

          <section className="flex flex-col gap-4 mt-6" aria-label="Security">
            {/*
              PASSWORD CHANGE UI
            */}
            {/* <h2 className="font-mono uppercase text-xs font-semibold text-text-muted">
              Security
            </h2>

            <section className={rowClassBorder}>
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
            {/* <section className={rowClass}>
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
            <h2
              id="danger-zone-heading"
              className="font-mono uppercase text-xs font-semibold text-text-muted"
            >
              Danger zone
            </h2>

            <div className={rowClass}>
              <div>
                <Label className="font-semibold text-control-error">
                  Delete account
                </Label>
                <p className="text-xs text-text-secondary">
                  Permanently remove your account and all data
                </p>
              </div>
              <Button
                className="focus:ring-1 dark:focus:ring-1"
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
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
