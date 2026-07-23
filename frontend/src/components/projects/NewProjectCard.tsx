// The last tile in the /projects grid: idle, it's a dashed-border button
// inviting the user to create a project. Clicking it swaps the same grid
// cell for an inline creation form (name + optional description) instead of
// opening a separate route or the global auth-style modal (see useModal) -
// there's no backend endpoint to create a project yet, so onCreate is a
// plain callback the parent decides what to do with, same pattern as
// ProjectCard's onManageMembers/onDeleteProject.
import { Button, TextInput } from "flowbite-react";
import { useId, useState, type SubmitEvent } from "react";
import { HiOutlinePlus, HiOutlineXMark } from "react-icons/hi2";

export interface NewProjectFormValues {
  name: string;
  description?: string;
}

interface NewProjectCardProps {
  onCreate?: (values: NewProjectFormValues) => void;
}

// Scoped to this card's 2 fields only - black background + secondary-toned
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

export function NewProjectCard({ onCreate }: NewProjectCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const nameInputId = useId();
  const descriptionInputId = useId();

  function handleClose() {
    setIsOpen(false);
    setName("");
    setDescription("");
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }
    onCreate?.({ name: trimmedName, description: description.trim() });
    handleClose();
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-surface-border p-4 text-center transition-colors hover:border-brand-500/50 hover:bg-surface-overlay/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-overlay text-text-secondary">
          <HiOutlinePlus className="h-5 w-5" aria-hidden="true" />
        </span>
        <span>
          <span className="block font-semibold text-text-primary">
            New project
          </span>
          <span className="mt-1 block text-sm text-text-secondary">
            Start from scratch
          </span>
        </span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-full flex-col gap-3 rounded-lg border border-brand-500 bg-surface-raised p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-primary">New project</h3>
        <button
          type="button"
          aria-label="Cancel new project"
          onClick={handleClose}
          className="rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <HiOutlineXMark className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        <label htmlFor={nameInputId} className="sr-only">
          Project name
        </label>
        <TextInput
          id={nameInputId}
          autoFocus
          maxLength={64}
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
          maxLength={140}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Short description (optional)"
          theme={projectFormInputTheme}
          value={description}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          disabled={!name.trim()}
          className="flex-1 bg-brand-500 text-black! hover:bg-brand-600 focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-green-300 dark:bg-brand-500 dark:hover:bg-brand-600 dark:focus:ring-green-800"
        >
          Create
        </Button>
        <Button
          type="button"
          onClick={handleClose}
          className="flex-1 border border-control-border bg-transparent! text-text-secondary! hover:bg-surface-overlay! hover:text-text-primary! focus:outline-none! focus-visible:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
