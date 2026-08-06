// Shared look of the small dropdown triggers in the /search toolbar. One
// literal for the two controls that use it (SearchFilters, SearchSortControl)
// so they can't drift apart by a padding step - and written out in full,
// because Tailwind only compiles class names it can see whole in the source.
export const SEARCH_CONTROL_TRIGGER_CLASS =
  "flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-brand-500 hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500/40";

// Rounds and insets the item highlight, which darkDropdownTheme leaves
// rectangular and edge-to-edge for the header panels it was written for. Same
// three lines ProjectCard, MemberListItem and DiscoveryBlockCard each declare
// locally; shared here because both search controls need it.
export const searchDropdownItemTheme = {
  container: "mx-1",
  base: "rounded-md text-xs",
};
