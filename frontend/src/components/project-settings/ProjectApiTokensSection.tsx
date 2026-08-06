import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Button,
  Checkbox,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  TextInput,
} from "flowbite-react";
import { HiOutlineExclamationTriangle } from "react-icons/hi2";
import { useToast } from "@/hooks/useToast";
import {
  darkSurfaceFieldClassName,
  darkSurfaceModalCancelButtonClass,
  darkSurfaceModalTheme,
  darkSurfaceTextInputTheme,
} from "@/lib/flowbite";
import {
  createProjectApiToken,
  deleteProjectApiToken,
  listProjectApiTokens,
  revokeProjectApiToken,
  type CreatedProjectApiToken,
  type ProjectApiToken,
} from "@/lib/projectApiTokensApi";
import { SettingsSection } from "./SettingsSection";

interface ProjectApiTokensSectionProps {
  projectId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  isArchived: boolean;
}

export function ProjectApiTokensSection({
  projectId,
  role,
  isArchived,
}: ProjectApiTokensSectionProps) {
  const [tokens, setTokens] = useState<ProjectApiToken[]>([]);
  const [label, setLabel] = useState("");
  const [labelError, setLabelError] = useState<string | null>(null);
  const [expiryDays, setExpiryDays] = useState("90");
  const [writeAccess, setWriteAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<ProjectApiToken | null>(
    null
  );
  const [isRevoking, setIsRevoking] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProjectApiToken | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [created, setCreated] = useState<CreatedProjectApiToken | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);
  const revealButtonRef = useRef<HTMLButtonElement>(null);
  const actionTriggerRef = useRef<HTMLButtonElement>(null);
  const tokenTableRef = useRef<HTMLTableElement>(null);
  const { showToast } = useToast();
  const canManage = role === "OWNER" || role === "ADMIN";
  const isMutating = isRevoking || isDeleting;

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setTokens(await listProjectApiTokens(projectId));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Failed to load API tokens"
      );
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      setCreated(null);
    };
  }, []);

  useEffect(() => {
    if (created) {
      requestAnimationFrame(() => revealButtonRef.current?.focus());
    }
  }, [created]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const trimmedLabel = label.trim();
    if (!canManage || isArchived || isCreating) {
      return;
    }
    if (!trimmedLabel) {
      setLabelError("Enter a label for this token.");
      return;
    }
    setIsCreating(true);
    try {
      const token = await createProjectApiToken(projectId, {
        label: trimmedLabel,
        permission: writeAccess ? "READ_WRITE" : "READ",
        expiresAt: expiryFromDays(expiryDays),
      });
      setTokens((current) => [token.token, ...current]);
      setCreated(token);
      setRevealed(false);
      setAcknowledged(false);
      setCopied(false);
      setLabel("");
      setLabelError(null);
      setWriteAccess(false);
      setExpiryDays("90");
    } catch (error) {
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to create API token",
      });
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke() {
    if (!pendingRevoke || isRevoking) {
      return;
    }
    setIsRevoking(true);
    try {
      const revoked = await revokeProjectApiToken(projectId, pendingRevoke.id);
      setTokens((current) =>
        current.map((token) => (token.id === revoked.id ? revoked : token))
      );
      setPendingRevoke(null);
      showToast({ type: "success", message: "API token revoked" });
      requestAnimationFrame(() => tokenTableRef.current?.focus());
    } catch (error) {
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to revoke API token",
      });
    } finally {
      setIsRevoking(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete || isDeleting) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteProjectApiToken(projectId, pendingDelete.id);
      setTokens((current) =>
        current.filter((token) => token.id !== pendingDelete.id)
      );
      setPendingDelete(null);
      showToast({ type: "success", message: "API token deleted" });
      requestAnimationFrame(() => tokenTableRef.current?.focus());
    } catch (error) {
      showToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to delete API token",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  async function copyCreatedToken() {
    if (!created) {
      return;
    }
    try {
      await navigator.clipboard.writeText(created.apiKey);
      setCopied(true);
    } catch {
      showToast({ type: "error", message: "Unable to copy API token" });
    }
  }

  function closeSecretModal() {
    setCreated(null);
    setRevealed(false);
    setAcknowledged(false);
    setCopied(false);
  }

  function closeActionModal(
    setPending: (token: ProjectApiToken | null) => void,
    isPending: boolean
  ) {
    if (isPending) {
      return;
    }
    setPending(null);
    requestAnimationFrame(() => actionTriggerRef.current?.focus());
  }

  return (
    <SettingsSection
      title="Project API tokens"
      description="Tokens are project-bound credentials for integrations and automation. They are not browser sessions."
    >
      <div className="space-y-6">
        {canManage && !isArchived ? (
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
            <div>
              <Label htmlFor="api-token-label">Token label</Label>
              <TextInput
                id="api-token-label"
                value={label}
                onChange={(event) => {
                  setLabel(event.target.value);
                  if (labelError) {
                    setLabelError(null);
                  }
                }}
                maxLength={100}
                required
                placeholder="CI integration"
                theme={darkSurfaceTextInputTheme}
              />
              {labelError && (
                <p className="mt-1 text-xs text-control-error">{labelError}</p>
              )}
            </div>
            <div>
              <Label htmlFor="api-token-expiry">Expires in</Label>
              <select
                id="api-token-expiry"
                value={expiryDays}
                onChange={(event) => setExpiryDays(event.target.value)}
                className={`mt-1 block w-full rounded-lg border p-2.5 text-sm ${darkSurfaceFieldClassName} bg-surface-raised text-text-primary`}
              >
                {expiryOptions.map(({ days, label }) => (
                  <option
                    key={days}
                    value={days}
                    className="bg-surface-raised text-text-primary"
                  >
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 md:col-span-2">
              <Label className="flex items-center gap-2 text-text-secondary">
                <Checkbox
                  checked
                  disabled
                  aria-label="Read permission is always included"
                  theme={projectApiTokenCheckboxTheme}
                  className="cursor-not-allowed !opacity-50"
                />
                Read access (always included)
              </Label>
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={writeAccess}
                  onChange={(event) => setWriteAccess(event.target.checked)}
                  theme={projectApiTokenCheckboxTheme}
                />
                Allow write access
              </Label>
              <span className="text-xs text-text-secondary sm:min-w-0 sm:flex-1">
                Write access can create, update, reorder, assign, and delete
                project tasks through the public API.
              </span>
              <Button
                type="submit"
                color="none"
                disabled={isCreating || !label.trim()}
                className={`${primaryButtonClassName} self-start sm:self-auto`}
              >
                {isCreating ? "Creating..." : "Create token"}
              </Button>
            </div>
          </form>
        ) : isArchived ? (
          <p className="text-xs text-text-secondary">
            This project is archived. Existing token history remains visible,
            but new tokens cannot be created.
          </p>
        ) : (
          <p className="text-xs text-text-secondary">
            Project owners and admins manage project API tokens. You can view
            their status but cannot create, revoke, or delete them.
          </p>
        )}

        {loadError ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-4 rounded-lg border border-control-error/40 bg-alert-bg px-3 py-2 text-xs text-control-error"
          >
            <span>Unable to load API tokens: {loadError}</span>
            <Button
              size="xs"
              color="none"
              onClick={() => void load()}
              className={secondaryButtonClassName}
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              ref={tokenTableRef}
              tabIndex={-1}
              aria-label="Project API tokens"
              className="w-full text-left text-xs text-text-secondary"
            >
              <thead className="border-b border-surface-border text-text-primary">
                <tr>
                  <th className="py-2 pr-3">Label</th>
                  <th className="py-2 pr-3">Permission</th>
                  <th className="py-2 pr-3">Expires</th>
                  <th className="py-2 pr-3">Last used</th>
                  <th className="py-2 pr-3">Status</th>
                  {canManage && <th className="py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => {
                  const inactive = token.revokedAt !== null || isExpired(token);
                  return (
                    <tr
                      key={token.id}
                      className="border-b border-surface-border"
                    >
                      <td className="py-3 pr-3 text-text-primary">
                        {token.label}
                      </td>
                      <td className="py-3 pr-3">
                        {token.permission === "READ_WRITE"
                          ? "Read & write"
                          : "Read"}
                      </td>
                      <td className="py-3 pr-3">
                        {formatDate(token.expiresAt)}
                      </td>
                      <td className="py-3 pr-3">
                        {token.lastUsedAt
                          ? formatDate(token.lastUsedAt)
                          : "Never"}
                      </td>
                      <td className="py-3 pr-3">
                        {token.revokedAt
                          ? "Revoked"
                          : isExpired(token)
                            ? "Expired"
                            : "Active"}
                      </td>
                      {canManage && (
                        <td className="py-3">
                          <div className="flex gap-2">
                            {!inactive && (
                              <Button
                                size="xs"
                                color="none"
                                onClick={(event) => {
                                  actionTriggerRef.current =
                                    event.currentTarget;
                                  setPendingRevoke(token);
                                }}
                                disabled={isMutating}
                                className={destructiveButtonClassName}
                              >
                                Revoke
                              </Button>
                            )}
                            {inactive && (
                              <Button
                                size="xs"
                                color="none"
                                onClick={(event) => {
                                  actionTriggerRef.current =
                                    event.currentTarget;
                                  setPendingDelete(token);
                                }}
                                disabled={isMutating}
                                className={destructiveButtonClassName}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {isLoading && (
                  <tr>
                    <td
                      className="py-3 text-text-secondary"
                      colSpan={canManage ? 6 : 5}
                    >
                      Loading API tokens...
                    </td>
                  </tr>
                )}
                {!isLoading && tokens.length === 0 && (
                  <tr>
                    <td
                      className="py-3 text-text-secondary"
                      colSpan={canManage ? 6 : 5}
                    >
                      No project API tokens have been created.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        show={created !== null}
        size="md"
        onClose={closeSecretModal}
        popup
        className={darkModalClassName}
        aria-labelledby="project-api-token-reveal-title"
        aria-describedby="project-api-token-reveal-description"
      >
        <div className="space-y-4 p-6">
          <h3
            id="project-api-token-reveal-title"
            className="text-sm font-semibold text-text-primary"
          >
            Copy this token now
          </h3>
          <p
            id="project-api-token-reveal-description"
            className="text-xs text-text-secondary"
          >
            It will not be shown again. Anyone with it can access this project
            until it expires or is revoked.
          </p>
          <code className="block break-all rounded bg-surface-overlay p-3 text-xs text-text-primary">
            {revealed && created
              ? created.apiKey
              : "********************************"}
          </code>
          <div className="flex gap-2">
            <Button
              ref={revealButtonRef}
              size="xs"
              color="none"
              aria-pressed={revealed}
              onClick={() => setRevealed((value) => !value)}
              className={secondaryButtonClassName}
            >
              {revealed ? "Hide" : "Reveal"}
            </Button>
            <Button
              size="xs"
              color="none"
              onClick={() => void copyCreatedToken()}
              className={primaryButtonClassName}
            >
              {copied ? "Copied" : "Copy token"}
            </Button>
          </div>
          <p className="sr-only" aria-live="polite">
            {copied ? "Token copied to clipboard." : ""}
          </p>
          <Label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              theme={projectApiTokenCheckboxTheme}
            />
            I have stored this token securely.
          </Label>
          <div className="flex justify-end gap-2">
            <Button
              color="none"
              onClick={closeSecretModal}
              className={secondaryButtonClassName}
            >
              Discard token
            </Button>
            <Button
              color="none"
              onClick={closeSecretModal}
              disabled={!acknowledged}
              className={primaryButtonClassName}
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Centered, icon-led warning layout matching every other destructive
      confirmation in this file's own settings page (RemoveMemberModal.tsx,
      LeaveProjectModal.tsx) - same darkSurfaceModalTheme + solid color="red"
      button, instead of this component's own previous left-aligned/ghost-red
      outline style. */}
      <Modal
        show={pendingRevoke !== null}
        dismissible
        size="md"
        theme={darkSurfaceModalTheme}
        onClose={() => closeActionModal(setPendingRevoke, isRevoking)}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="flex flex-col items-center gap-4 pb-2 text-center">
            <HiOutlineExclamationTriangle className="h-10 w-10 text-control-error" />
            <h3 className="text-lg font-semibold text-text-primary">
              Revoke{" "}
              <span className="font-semibold">{pendingRevoke?.label}</span>?
            </h3>
            <p className="text-sm text-text-secondary">
              It stops working immediately. This cannot be undone.
            </p>
            <div className="mt-2 flex w-full flex-col justify-center gap-3 sm:flex-row">
              <Button
                className={darkSurfaceModalCancelButtonClass}
                disabled={isRevoking}
                onClick={() => closeActionModal(setPendingRevoke, isRevoking)}
              >
                Cancel
              </Button>
              <Button
                color="red"
                disabled={isRevoking}
                onClick={() => void handleRevoke()}
              >
                {isRevoking ? "Revoking..." : "Revoke"}
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>

      <Modal
        show={pendingDelete !== null}
        dismissible
        size="md"
        theme={darkSurfaceModalTheme}
        onClose={() => closeActionModal(setPendingDelete, isDeleting)}
        popup
      >
        <ModalHeader />
        <ModalBody>
          <div className="flex flex-col items-center gap-4 pb-2 text-center">
            <HiOutlineExclamationTriangle className="h-10 w-10 text-control-error" />
            <h3 className="text-lg font-semibold text-text-primary">
              Delete{" "}
              <span className="font-semibold">{pendingDelete?.label}</span>?
            </h3>
            <p className="text-sm text-text-secondary">
              This removes it from the active token history. Its audit record
              remains.
            </p>
            <div className="mt-2 flex w-full flex-col justify-center gap-3 sm:flex-row">
              <Button
                className={darkSurfaceModalCancelButtonClass}
                disabled={isDeleting}
                onClick={() => closeActionModal(setPendingDelete, isDeleting)}
              >
                Cancel
              </Button>
              <Button
                color="red"
                disabled={isDeleting}
                onClick={() => void handleDelete()}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </ModalBody>
      </Modal>
    </SettingsSection>
  );
}

const expiryOptions = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
  { days: 180, label: "180 days" },
  { days: 365, label: "365 days" },
];

const primaryButtonClassName =
  "bg-brand-500 !text-black hover:bg-brand-600 focus:ring-4 focus:ring-green-300 dark:bg-brand-500 dark:hover:bg-brand-600 dark:focus:ring-green-800";

const secondaryButtonClassName =
  "border border-control-border bg-transparent! text-text-secondary! hover:bg-surface-overlay! hover:text-text-primary! focus:ring-2 focus:ring-brand-500/40 dark:focus:ring-brand-500/40 focus:outline-none! focus-visible:outline-none";

const destructiveButtonClassName =
  "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-500 dark:hover:bg-red-500/20 focus-visible:!outline-none focus-visible:!ring-2 focus-visible:!ring-red-500 dark:focus:!ring-red-500";

const darkModalClassName =
  "[&>div>div]:!bg-surface-raised [&>div>div]:!border [&>div>div]:!border-control-bg";

const projectApiTokenCheckboxTheme = {
  base: "border-surface-border bg-surface-overlay dark:border-surface-border dark:bg-surface-overlay",
  color: {
    default:
      "text-brand-500 focus:ring-2 focus:ring-brand-500/40 dark:focus:ring-brand-500/40",
  },
};

function expiryFromDays(value: string): string {
  const days = Number(value);
  const validDays = expiryOptions.some((option) => option.days === days)
    ? days
    : 90;
  return new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString();
}

function isExpired(token: ProjectApiToken): boolean {
  return new Date(token.expiresAt) <= new Date();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
