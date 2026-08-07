// The last tile in the /projects grid: idle, it's a dashed-border button
// inviting the user to create a project. Clicking it swaps the same grid
// cell for an inline creation form (name + optional description) instead of
// opening a separate route or the global auth-style modal (see useModal).
import { useState } from "react";
import { HiOutlinePlus } from "react-icons/hi2";
import {
  ProjectDetailsForm,
  type ProjectFormValues,
} from "./ProjectDetailsForm";

export interface NewProjectFormValues {
  name: string;
  description?: string;
}

interface NewProjectCardProps {
  onCreate: (values: NewProjectFormValues) => Promise<boolean>;
}

export function NewProjectCard({ onCreate }: NewProjectCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleClose() {
    setIsOpen(false);
  }

  // ProjectDetailsForm unmounts when isOpen goes false (the idle button
  // renders in its place below), so its internal name/description state -
  // and this form instance entirely - resets on its own the next time this
  // reopens. No explicit "clear the fields" step needed.
  async function handleSubmit(values: ProjectFormValues) {
    setIsSubmitting(true);
    try {
      const wasCreated = await onCreate(values);
      if (wasCreated) {
        handleClose();
      }
    } finally {
      setIsSubmitting(false);
    }
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
    <ProjectDetailsForm
      title="New project"
      cancelLabel="Cancel new project"
      submitLabel="Create"
      submittingLabel="Creating..."
      isSubmitting={isSubmitting}
      onSubmit={(values) => void handleSubmit(values)}
      onCancel={handleClose}
    />
  );
}
