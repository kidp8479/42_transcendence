import type { CategoryColor } from "@/lib/categoryColorPalette";

export const darkTextInputTheme = {
  field: {
    input: {
      colors: {
        gray: "!border-control-border !bg-control-bg text-text-primary placeholder:!text-control-placeholder focus:!border-brand-500 focus:!ring-2 focus:!ring-green-500/40 focus-visible:!outline-none",
        failure:
          "!border-control-error !bg-control-bg text-text-primary placeholder:!text-control-placeholder focus:!border-control-error focus:!bg-control-bg focus:!ring-2 focus:!ring-control-error/40 focus-visible:!outline-none",
      },
    },
  },
};

// surface-* tokens (dark neutral) instead of control-* (lighter blue-gray,
// meant for auth forms) - for form fields on darker pages like Discovery.
// !important overrides Flowbite's own default classes. Works as a plain
// className on Textarea, but TextInput's className only reaches an outer
// wrapper div - its actual <input> background needs the `theme` prop instead
// (see darkSurfaceTextInputTheme below).
export const darkSurfaceFieldClassName =
  "!border-surface-border !bg-surface-overlay text-text-primary dark:!border-surface-border dark:!bg-surface-overlay focus:!border-brand-500 focus:!ring-2 focus:!ring-green-500/40 focus-visible:!outline-none";

export const darkSurfaceTextInputTheme = {
  field: {
    input: {
      colors: {
        gray: darkSurfaceFieldClassName,
      },
    },
  },
};

// border/checkmark tinted with a CATEGORY_COLOR_PALETTE entry instead of
// Flowbite's default gray border/primary-blue checkmark. `theme` here is
// merged with Checkbox's own default theme via twMerge, so only the
// conflicting classes are overridden - checked:bg-current on the base theme
// is what makes color.default's text-{color} become the checkmark's fill.
// A function rather than a static object: the card and the edit screen each
// need this tinted with their own block's color, not one fixed color.
export function buildCategoryCheckboxTheme(color: CategoryColor) {
  return {
    base: "border-surface-border dark:border-surface-border bg-surface-overlay dark:bg-surface-overlay",
    // needs both focus: and dark:focus: prefixes to actually beat Flowbite's
    // own same-specificity focus:ring-primary-600 / dark:focus:ring-primary-600
    color: {
      default:
        color.text +
        " focus:ring-2 focus:" +
        color.ring +
        " dark:focus:" +
        color.ring,
    },
  };
}

export const darkAlertTheme = {
  color: {
    failure: "border !border-control-error !bg-alert-bg !text-control-error",
  },
  icon: "mr-3 inline h-5 w-5 shrink-0 text-control-error",
};

export const darkDropdownTheme = {
  floating: {
    base: "z-10 w-fit rounded-lg border !border-surface-border !bg-surface-raised !text-text-primary shadow-xl focus:outline-none dark:!border-surface-border dark:!bg-surface-raised dark:!text-text-primary",
    content: "py-1 text-sm text-text-primary",
    divider: "my-1 h-px !bg-surface-border dark:!bg-surface-border",
    header:
      "block border-b !border-surface-border px-4 py-2 text-sm !text-text-primary dark:!border-surface-border dark:!text-text-primary",
    item: {
      container: "",
      base: "flex w-full cursor-pointer items-center justify-start px-4 py-2 text-sm !text-text-primary hover:!bg-surface-overlay focus:!bg-surface-overlay focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:!text-text-primary dark:hover:!bg-surface-overlay dark:focus:!bg-surface-overlay",
      icon: "mr-2 h-4 w-4",
    },
  },
};
