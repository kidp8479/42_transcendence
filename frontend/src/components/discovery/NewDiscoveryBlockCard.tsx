// Last tile in the Discovery grid, same pattern as NewProjectCard.tsx: idle,
// it's a dashed-border button; clicking it swaps the same grid cell for an
// inline creation form instead of a separate route or modal. Only asks for
// a title - color/icon/description are set afterward on the edit screen.
import { Button, TextInput } from "flowbite-react";
import { useId, useState, type FormEvent } from "react";
import { HiOutlinePlus, HiOutlineXMark } from "react-icons/hi2";
import { DISCOVERY_BLOCK_TITLE_MAX_LENGTH } from "@/lib/discoveryBlocks";

interface NewDiscoveryBlockCardProps {
  onCreate: (title: string) => Promise<boolean>;
}

const newBlockFormInputTheme = {
  field: {
    input: {
      colors: {
        gray: "!border-control-border !bg-black text-text-primary placeholder:!text-text-secondary focus:!border-brand-500 focus:!ring-2 focus:!ring-green-500/40 focus-visible:!outline-none",
      },
    },
  },
};

export function NewDiscoveryBlockCard({
  onCreate,
}: NewDiscoveryBlockCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleInputId = useId();

  function handleClose() {
    setIsOpen(false);
    setTitle("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }
    setIsSubmitting(true);
    try {
      const wasCreated = await onCreate(trimmedTitle);
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
            New category
          </span>
          <span className="mt-1 block text-sm text-text-secondary">
            Break down another part of the subject
          </span>
        </span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-full flex-col gap-3 rounded-lg border border-brand-500 bg-surface-raised p-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-primary">New category</h3>
        <button
          type="button"
          aria-label="Cancel new category"
          onClick={handleClose}
          className="rounded-md p-1 text-text-muted hover:bg-surface-overlay hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          <HiOutlineXMark className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3">
        <label htmlFor={titleInputId} className="sr-only">
          Category title
        </label>
        <TextInput
          id={titleInputId}
          autoFocus
          maxLength={DISCOVERY_BLOCK_TITLE_MAX_LENGTH}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Category title (e.g. Constraints)"
          required
          theme={newBlockFormInputTheme}
          value={title}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          disabled={!title.trim() || isSubmitting}
          className="flex-1 bg-brand-500 !text-black hover:bg-brand-600 focus:outline-none focus-visible:outline-none focus:ring-4 focus:ring-green-300 dark:bg-brand-500 dark:hover:bg-brand-600 dark:focus:ring-green-800"
        >
          {isSubmitting ? "Creating..." : "Create"}
        </Button>
        <Button
          type="button"
          onClick={handleClose}
          disabled={isSubmitting}
          className="flex-1 border border-control-border bg-transparent! text-text-secondary! hover:bg-surface-overlay! hover:text-text-primary! focus:outline-none! focus-visible:outline-none focus:ring-2 focus:ring-brand-500/40"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
