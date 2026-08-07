// Shared name+description form shell, extracted so NewProjectCard.tsx
// (create) and ProjectCard.tsx's edit mode (update) render the exact same
// UI instead of two hand-copied versions that would drift the first time
// either one gets a styling tweak - see the KNOWN DUPLICATION comments on
// LeaveProjectModal.tsx/RemoveMemberModal.tsx for what that already cost
// elsewhere in this app.
//
// Deliberately "dumb": owns only the two input fields' local state and the
// submit-time name/description shaping (trim, blank description -> undefined).
// Everything about *when* this is shown, whether submission succeeded, and
// what happens next belongs to the caller - this component doesn't know if
// it's creating or editing, doesn't call any API, and doesn't manage its own
// open/closed state.
import { Button, TextInput } from "flowbite-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { HiOutlineXMark } from "react-icons/hi2";
import {
  maxProjectDescriptionLength,
  maxProjectNameLength,
} from "@/lib/projectsApi";

export interface ProjectFormValues {
  name: string;
  description?: string;
}

interface ProjectDetailsFormProps {
  title: string;
  cancelLabel: string;
  initialName?: string;
  initialDescription?: string;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  onSubmit: (values: ProjectFormValues) => void;
  onCancel: () => void;
  // Slot for edit-mode's 409 conflict warning - create mode never passes
  // this, so it renders nothing there.
  banner?: ReactNode;
}

// Scoped to this form's 2 fields only - black background + secondary-toned
// text/placeholder, instead of the app-wide darkTextInputTheme (control-bg
// background, primary-toned text) used by auth forms.
const projectFormInputTheme = {
  field: {
    input: {
      colors: {
        gray: "!border-control-border !bg-black text-text-primary placeholder:!text-text-secondary focus:!border-brand-500 focus:!ring-2 focus:!ring-green-500/40 focus-visible:!outline-none",
      },
    },
  },
};

export function ProjectDetailsForm({
  title,
  cancelLabel,
  initialName = "",
  initialDescription = "",
  submitLabel,
  submittingLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  banner,
}: ProjectDetailsFormProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const nameInputId = useId();
  const descriptionInputId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }
    onSubmit({
      name: trimmedName,
      description: description.trim() || undefined,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-full flex-col gap-3 rounded-lg border border-brand-500 bg-surface-raised p-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-primary">{title}</h3>
        <button
          type="button"
          aria-label={cancelLabel}
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <HiOutlineXMark className="h-5 w-5" />
        </button>
      </div>

      {banner}

      <div className="flex flex-1 flex-col justify-center gap-3">
        <label htmlFor={nameInputId} className="sr-only">
          Project name
        </label>
        <TextInput
          id={nameInputId}
          autoFocus
          maxLength={maxProjectNameLength}
          onChange={(event) => setName(event.target.value)}
          placeholder="Project name (e.g. ft_irc)"
          required
          theme={projectFormInputTheme}
          value={name}
        />

        <label htmlFor={descriptionInputId} className="sr-only">
          Short description
        </label>
        <TextInput
          id={descriptionInputId}
          maxLength={maxProjectDescriptionLength}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Short description (optional)"
          theme={projectFormInputTheme}
          value={description}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          disabled={!name.trim() || isSubmitting}
          className="flex-1 bg-brand-500 !text-black hover:bg-brand-600 focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-green-300 dark:bg-brand-500 dark:hover:bg-brand-600 dark:focus:ring-green-800"
        >
          {isSubmitting ? submittingLabel : submitLabel}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 border border-control-border bg-transparent! text-text-secondary! hover:bg-surface-overlay! hover:text-text-primary! focus:outline-none! focus-visible:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
