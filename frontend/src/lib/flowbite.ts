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

// overrides Flowbite's default blue (primary-*) popup with our own
// surface/brand tokens - only the parts that reference blue or the
// light-mode white background, everything else keeps Flowbite's default
const datepickerSelectedDayClassName =
  "!bg-brand-500 !text-black hover:!bg-brand-600";
const datepickerDayItemClassName =
  "block flex-1 cursor-pointer rounded-lg border-0 text-center text-sm font-semibold leading-9 !text-text-primary hover:!bg-surface-overlay dark:!text-text-primary dark:hover:!bg-surface-overlay";

export const darkDatepickerTheme = {
  popup: {
    root: {
      inner:
        "inline-block rounded-lg border !border-surface-border !bg-surface-overlay p-4 shadow-lg dark:!border-surface-border dark:!bg-surface-overlay",
    },
    header: {
      title:
        "px-2 py-3 text-center font-semibold !text-text-primary dark:!text-text-primary",
      selectors: {
        button: {
          base: "rounded-lg !bg-surface-raised px-5 py-2.5 text-sm font-semibold !text-text-primary hover:!bg-surface-overlay focus:outline-none focus:ring-2 focus:ring-green-500/40 dark:!bg-surface-raised dark:!text-text-primary dark:hover:!bg-surface-overlay",
        },
      },
    },
    footer: {
      button: {
        today:
          "!bg-brand-500 !text-black hover:!bg-brand-600 dark:!bg-brand-500 dark:hover:!bg-brand-600",
        clear:
          "border !border-control-border !bg-surface-raised !text-text-primary hover:!bg-surface-overlay dark:!border-control-border dark:!bg-surface-raised dark:!text-text-primary dark:hover:!bg-surface-overlay",
      },
    },
  },
  views: {
    days: {
      header: {
        title:
          "h-6 text-center text-sm font-medium leading-6 !text-text-secondary dark:!text-text-secondary",
      },
      items: {
        item: {
          base: datepickerDayItemClassName,
          selected: datepickerSelectedDayClassName,
        },
      },
    },
    months: {
      items: {
        item: {
          base: datepickerDayItemClassName,
          selected: datepickerSelectedDayClassName,
        },
      },
    },
    years: {
      items: {
        item: {
          base: datepickerDayItemClassName,
          selected: datepickerSelectedDayClassName,
        },
      },
    },
    decades: {
      items: {
        item: {
          base: datepickerDayItemClassName,
          selected: datepickerSelectedDayClassName,
        },
      },
    },
  },
};

// the popup anchors by its left edge by default, which is fine for a field
// on the left of a row, but overflows past the drawer's edge for a field on
// the right (ex: EventForm's End date) - this variant anchors it by the
// right edge instead so it opens toward the left
export const darkDatepickerThemeAlignRight = {
  ...darkDatepickerTheme,
  popup: {
    ...darkDatepickerTheme.popup,
    root: {
      ...darkDatepickerTheme.popup.root,
      base: "absolute top-10 right-0 z-50 block pt-2",
    },
  },
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
