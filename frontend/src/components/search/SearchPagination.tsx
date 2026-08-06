// Previous / Page X of Y / Next for the active result group.
//
// Hand-rolled rather than Flowbite's Pagination: this app's minimal Flowbite
// theme zeroes every --shadow-* variable (which also kills `ring`, being
// box-shadow based), so an unthemed Flowbite component arrives asking for
// depth that no longer exists and has to be re-dressed anyway. The repo
// already hand-rolls its tab bars for the same reason.
//
// `limit` is whatever the SERVER said it applied, not what the page asked for:
// on type=all it pins the limit to a five-row preview, and a paginator built
// on a requested-but-ignored limit would offer pages that don't exist.
interface SearchPaginationProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
}

// hover:border-brand-500, like every other clickable surface on this page: a
// button whose only hover feedback is its label changing shade doesn't read as
// clickable at all.
const PAGE_BUTTON_CLASS =
  "rounded-md border border-surface-border bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-brand-500 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-surface-border disabled:hover:text-text-secondary";

export function SearchPagination({
  page,
  limit,
  total,
  onPageChange,
}: SearchPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / limit));

  // One page is not a pagination, it is two dead buttons.
  if (pageCount <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Search results pages"
      className="flex items-center justify-center gap-3 pt-2"
    >
      <button
        type="button"
        className={PAGE_BUTTON_CLASS}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span className="text-xs text-text-secondary">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        className={PAGE_BUTTON_CLASS}
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
