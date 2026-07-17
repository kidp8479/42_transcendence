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
